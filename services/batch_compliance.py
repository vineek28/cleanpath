"""
ClearPath Batch Compliance Engine
==================================
Rule-based compliance checker for patient encounters.
Runs WITHOUT Claude — deterministic, fast, defensible.
Claude only runs when a patient requests a full narrative report.

Design principle: rules are explicit, traceable, and legally grounded.
Every flag maps to a specific law and requirement ID.
"""

import sqlite3
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from services.db import get_conn, q, DB_PATH

# ── Compliance Rules ──────────────────────────────────────────────────────────
# Each rule: tool → requirement → law → action
# Source: HIPAA, TRAIGA, CMS AI Strategy, HHS AI Safety Program

COMPLIANCE_RULES = [
    {
        "rule_id": "RULE_001",
        "name": "Consumer LLM — No BAA",
        "trigger_tools": ["chatgpt_clinical"],
        "severity": "critical",
        "law": "HIPAA Privacy Rule § 164.502",
        "requirement": "Business Associate Agreement required for any vendor with PHI access",
        "finding": "ChatGPT/Consumer LLM used in clinical context without a BAA on file. Any patient data processed constitutes a HIPAA violation.",
        "action": "Immediately restrict consumer LLM access to clinical systems. Obtain BAA or switch to enterprise solution.",
        "disclosure_required": True,
        "timeline": "Immediate — within 72 hours",
    },
    {
        "rule_id": "RULE_002",
        "name": "Billing AI — No Human Override Documentation",
        "trigger_tools": ["billing_coding_ai", "optum_claims_ai"],
        "severity": "high",
        "law": "CMS Medicare Claims Processing Manual § 4.2",
        "requirement": "AI-suggested billing codes require documented human review before submission",
        "finding": "AI-assisted billing active with no documented human override process. Medicare fraud exposure.",
        "action": "Implement mandatory human review workflow. Document all AI billing suggestions vs final codes.",
        "disclosure_required": False,
        "timeline": "Within 30 days",
    },
    {
        "rule_id": "RULE_003",
        "name": "Clinical AI — No Patient Disclosure",
        "trigger_tools": ["epic_sepsis_model", "radiology_ai_cad", "viz_ai", "ehr_predictive_analytics"],
        "severity": "high",
        "law": "HHS AI Safety Program — Patient Transparency Requirement (2025)",
        "requirement": "Patients must be informed when AI systems influence clinical decisions",
        "finding": "Clinical AI tool active with no patient disclosure policy documented.",
        "action": "Implement patient notification process. Update admission consent forms to include AI disclosure.",
        "disclosure_required": True,
        "timeline": "Within 45 days",
    },
    {
        "rule_id": "RULE_004",
        "name": "Sepsis Model — Bias Monitoring Overdue",
        "trigger_tools": ["epic_sepsis_model"],
        "severity": "high",
        "law": "CMS AI Strategy — Algorithmic Bias Requirement",
        "requirement": "Quarterly demographic bias monitoring required for clinical decision support AI",
        "finding": "Epic Sepsis Model active without documented quarterly bias monitoring. CMS requires demographic breakdown of alert rates.",
        "action": "Implement quarterly bias monitoring. Generate demographic breakdown report for current quarter.",
        "disclosure_required": False,
        "timeline": "Within 90 days",
    },
    {
        "rule_id": "RULE_005",
        "name": "Radiology AI — FDA 510(k) Compliance",
        "trigger_tools": ["radiology_ai_cad", "viz_ai"],
        "severity": "high",
        "law": "FDA 21 CFR Part 892 — AI/ML Medical Device Software",
        "requirement": "AI-based CADe/CADx devices require FDA 510(k) clearance documentation",
        "finding": "AI radiology tool active without verified FDA clearance documentation in governance records.",
        "action": "Verify and document FDA 510(k) clearance number for each AI radiology tool.",
        "disclosure_required": False,
        "timeline": "Within 30 days",
    },
    {
        "rule_id": "RULE_006",
        "name": "Prior Auth AI — CMS 2026 Scrutiny",
        "trigger_tools": ["optum_claims_ai"],
        "severity": "high",
        "law": "CMS Prior Authorization Rule (CMS-0057-F)",
        "requirement": "AI-based prior authorization decisions must be explainable and auditable",
        "finding": "Prior authorization AI active. CMS 2026 enforcement requires documented decision criteria for each denial.",
        "action": "Document AI decision criteria. Implement human review for all AI-recommended denials.",
        "disclosure_required": True,
        "timeline": "Within 60 days",
    },
    {
        "rule_id": "RULE_007",
        "name": "Ambient AI — Patient Consent",
        "trigger_tools": ["nuance_dax", "ambient_clinical_intelligence"],
        "severity": "medium",
        "law": "State Wiretapping Laws + HIPAA Consent Requirements",
        "requirement": "Ambient recording AI requires explicit patient consent before activation",
        "finding": "Ambient clinical AI active. Patient consent documentation required before recording clinical encounters.",
        "action": "Implement pre-encounter consent process for ambient AI. Update EHR consent workflow.",
        "disclosure_required": True,
        "timeline": "Within 45 days",
    },
    {
        "rule_id": "RULE_008",
        "name": "Multiple AI — No Governance Committee",
        "trigger_tools": None,  # triggers when tool_count >= 3
        "severity": "high",
        "law": "CMS AI Strategy — Governance Requirement",
        "requirement": "Hospitals with 3+ clinical AI tools require a formal AI governance committee",
        "finding": "Multiple AI systems active without documented governance committee oversight.",
        "action": "Establish AI governance committee. Document charter, meeting cadence, and oversight responsibilities.",
        "disclosure_required": False,
        "timeline": "Within 90 days",
    },
]


def _ensure_workflow_columns():
    """Ensure workflow columns exist — safe to call multiple times."""
    with get_conn() as conn:
        for col, default in [
            ('workflow_status', "'needs_review'"),
            ('workflow_note', "''"),
            ('status_updated_at', "NULL"),
            ('source', "'synthetic'"),
        ]:
            try:
                conn.execute(f"ALTER TABLE patient_encounters ADD COLUMN {col} TEXT DEFAULT {default}")
            except Exception:
                pass

_ensure_workflow_columns()

def run_batch_compliance(hospital_npi: str, confirmed_tools: list = None) -> dict:
    """
    Run rule-based compliance check on all patient encounters for a hospital.
    Returns compliance findings per patient — no Claude required.
    """
    with get_conn() as conn:
        patients = conn.execute(
            "SELECT * FROM patient_encounters WHERE hospital_npi = ?",
            (hospital_npi,)
        ).fetchall()

    if not patients:
        return {"error": "No patient encounters found. Run batch seeding first."}

    batch_id = str(uuid.uuid4())
    results = []
    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0,
                "disclosure_required": 0, "total_findings": 0}

    for patient in patients:
        p = dict(patient)
        tools = json.loads(p.get("ai_tools_used", "[]"))

        # Use confirmed tools if provided (hospital just ran the form)
        # Otherwise use patient's own tool list
        effective_tools = confirmed_tools if confirmed_tools else tools

        findings = []
        for rule in COMPLIANCE_RULES:
            # Special case: multi-tool governance rule
            if rule["trigger_tools"] is None:
                if len(effective_tools) >= 3:
                    findings.append({
                        "rule_id": rule["rule_id"],
                        "name": rule["name"],
                        "severity": rule["severity"],
                        "law": rule["law"],
                        "finding": rule["finding"],
                        "action": rule["action"],
                        "disclosure_required": rule["disclosure_required"],
                        "timeline": rule["timeline"],
                    })
            else:
                # Check if any trigger tool is in effective tools
                if any(t in effective_tools for t in rule["trigger_tools"]):
                    findings.append({
                        "rule_id": rule["rule_id"],
                        "name": rule["name"],
                        "severity": rule["severity"],
                        "law": rule["law"],
                        "finding": rule["finding"],
                        "action": rule["action"],
                        "disclosure_required": rule["disclosure_required"],
                        "timeline": rule["timeline"],
                    })

        # Calculate risk
        severities = [f["severity"] for f in findings]
        if "critical" in severities:
            risk = "critical"
        elif "high" in severities:
            risk = "high"
        elif "medium" in severities:
            risk = "medium"
        else:
            risk = "low"

        needs_disclosure = any(f["disclosure_required"] for f in findings)
        disclosure_status = "required" if needs_disclosure else "not_required"

        # Compliance score for this patient
        score = 100
        for f in findings:
            score -= {"critical": 30, "high": 15, "medium": 8, "low": 3}.get(f["severity"], 0)
        score = max(0, score)

        results.append({
            "patient_id": p["id"],
            "mrn": p["mrn"],
            "adm_id": p["adm_id"],
            "name": f"{p['first_name']} {p['last_name']}",
            "archetype": p["archetype"],
            "department": p["department"],
            "icd10_desc": p["icd10_desc"],
            "ai_tools": effective_tools,
            "findings": findings,
            "risk_level": risk,
            "compliance_score": score,
            "disclosure_required": needs_disclosure,
            "findings_count": len(findings),
            "needs_claude_analysis": risk in ["critical", "high"] or len(findings) >= 3,
        })

        summary[risk] += 1
        summary["total_findings"] += len(findings)
        if needs_disclosure:
            summary["disclosure_required"] += 1

    # Store results in DB
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS batch_compliance_results (
                id TEXT PRIMARY KEY,
                batch_id TEXT,
                hospital_npi TEXT,
                patient_id TEXT,
                run_at TEXT,
                findings_json TEXT,
                risk_level TEXT,
                compliance_score INTEGER,
                disclosure_required INTEGER,
                findings_count INTEGER,
                needs_claude_analysis INTEGER
            )
        """)
        for r in results:
            conn.execute("""
                INSERT OR REPLACE INTO batch_compliance_results VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """, (
                str(uuid.uuid4()), batch_id, hospital_npi,
                r["patient_id"],
                datetime.now(timezone.utc).isoformat(),
                json.dumps(r["findings"]),
                r["risk_level"], r["compliance_score"],
                1 if r["disclosure_required"] else 0,
                r["findings_count"],
                1 if r["needs_claude_analysis"] else 0,
            ))

        # Store delta snapshot
        conn.execute("""
            CREATE TABLE IF NOT EXISTS compliance_snapshots (
                id TEXT PRIMARY KEY,
                hospital_npi TEXT,
                snapshot_at TEXT,
                total_patients INTEGER,
                critical_count INTEGER,
                high_count INTEGER,
                medium_count INTEGER,
                low_count INTEGER,
                total_findings INTEGER,
                disclosure_required INTEGER,
                avg_score REAL,
                confirmed_tools_json TEXT
            )
        """)
        avg_score = sum(r["compliance_score"] for r in results) / len(results) if results else 0
        conn.execute("""
            INSERT INTO compliance_snapshots VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            str(uuid.uuid4()), hospital_npi,
            datetime.now(timezone.utc).isoformat(),
            len(results),
            summary["critical"], summary["high"],
            summary["medium"], summary["low"],
            summary["total_findings"],
            summary["disclosure_required"],
            round(avg_score, 1),
            json.dumps(confirmed_tools or []),
        ))

    return {
        "batch_id": batch_id,
        "total_patients": len(results),
        "summary": summary,
        "avg_compliance_score": round(avg_score, 1),
        "results": results,
    }


def get_delta(hospital_npi: str) -> dict:
    """Compare latest two compliance snapshots to show what changed."""
    with get_conn() as conn:
        try:
            snapshots = conn.execute("""
                SELECT * FROM compliance_snapshots
                WHERE hospital_npi = ?
                ORDER BY snapshot_at DESC LIMIT 2
            """, (hospital_npi,)).fetchall()
        except Exception:
            return {}

    if len(snapshots) < 2:
        return {"has_delta": False, "message": "Run batch compliance at least twice to see delta"}

    curr, prev = dict(snapshots[0]), dict(snapshots[1])
    return {
        "has_delta": True,
        "current_avg_score": curr["avg_score"],
        "previous_avg_score": prev["avg_score"],
        "score_change": round(curr["avg_score"] - prev["avg_score"], 1),
        "critical_change": curr["critical_count"] - prev["critical_count"],
        "high_change": curr["high_count"] - prev["high_count"],
        "disclosure_change": curr["disclosure_required"] - prev["disclosure_required"],
        "current_date": curr["snapshot_at"][:10],
        "previous_date": prev["snapshot_at"][:10],
        "improved": curr["avg_score"] > prev["avg_score"],
    }


def get_patient_by_mrn(hospital_npi: str, mrn: str) -> dict:
    """Look up a patient encounter by MRN — used by patient login."""
    with get_conn() as conn:
        try:
            row = conn.execute("""
                SELECT pe.*, bcr.findings_json, bcr.compliance_score, bcr.needs_claude_analysis
                FROM patient_encounters pe
                LEFT JOIN batch_compliance_results bcr ON pe.id = bcr.patient_id
                WHERE pe.hospital_npi = ? AND pe.mrn = ?
                ORDER BY pe.admission_date DESC LIMIT 1
            """, (hospital_npi, mrn)).fetchone()
        except Exception:
            return {}

    if not row:
        return {}
    return dict(row)


def get_disclosure_count(hospital_npi: str) -> int:
    """Count patients needing disclosure — for results page summary."""
    with get_conn() as conn:
        try:
            row = conn.execute("""
                SELECT COUNT(*) FROM batch_compliance_results
                WHERE hospital_npi = ? AND disclosure_required = 1
            """, (hospital_npi,)).fetchone()
            return row[0] if row else 0
        except Exception:
            return 0


def update_patient_status(patient_id: str, status: str, note: str = '') -> bool:
    """Update workflow status for a patient encounter."""
    valid = ['needs_review', 'disclosure_pending', 'disclosure_sent', 'escalated', 'compliant']
    if status not in valid:
        return False
    _ensure_workflow_columns()
    with get_conn() as conn:
        conn.execute("""
            UPDATE patient_encounters
            SET workflow_status = ?, workflow_note = ?, status_updated_at = ?
            WHERE id = ?
        """, (status, note, datetime.now(timezone.utc).isoformat(), patient_id))
    return True


def get_triage_summary(hospital_npi: str) -> dict:
    """Get triage counts for action queues."""
    _ensure_workflow_columns()
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT risk_level, workflow_status, disclosure_status, admission_date, id
            FROM patient_encounters WHERE hospital_npi = ?
        """, (hospital_npi,)).fetchall()

    patients = [dict(r) for r in rows]
    from datetime import date
    today = date.today().isoformat()

    critical    = [p for p in patients if p['risk_level'] == 'critical']
    overdue     = [p for p in patients if p.get('disclosure_status') == 'overdue']
    pending     = [p for p in patients if p.get('disclosure_status') == 'pending']
    sent        = [p for p in patients if p.get('disclosure_status') == 'sent']
    escalated   = [p for p in patients if p.get('workflow_status') == 'escalated']

    return {
        'total': len(patients),
        'critical': len(critical),
        'overdue_disclosure': len(overdue),
        'pending_disclosure': len(pending),
        'sent_disclosure': len(sent),
        'escalated': len(escalated),
        'compliant': len([p for p in patients if p['risk_level'] == 'low' and p.get('disclosure_status') in ['sent','exempt']]),
    }


# Deadline mapping per rule — how many days to remediate
RULE_DEADLINES = {
    'RULE_001': {'days': 3,   'label': '72 hours', 'law': 'HIPAA'},
    'RULE_002': {'days': 30,  'label': '30 days',  'law': 'CMS'},
    'RULE_003': {'days': 45,  'label': '45 days',  'law': 'HHS'},
    'RULE_004': {'days': 90,  'label': '90 days',  'law': 'CMS'},
    'RULE_005': {'days': 30,  'label': '30 days',  'law': 'FDA'},
    'RULE_006': {'days': 60,  'label': '60 days',  'law': 'CMS'},
    'RULE_007': {'days': 45,  'label': '45 days',  'law': 'State'},
    'RULE_008': {'days': 90,  'label': '90 days',  'law': 'CMS'},
}
