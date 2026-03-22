"""
ClearPath Audit Trail — SQLite persistence layer
Every scan is logged with full inputs, outputs, and timestamps.
HIPAA-aware: no patient PII stored, only de-identified compliance metadata.
"""
import sqlite3
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "clearpath_audit.db"

def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database schema."""
    with _get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS scans (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                scan_type TEXT NOT NULL,        -- 'hospital' | 'patient' | 'combined'
                hospital_npi TEXT,
                hospital_name TEXT,
                hospital_state TEXT,
                hospital_type TEXT,
                hospital_size TEXT,
                ai_tools_count INTEGER,
                ai_tools_json TEXT,
                compliance_score INTEGER,
                risk_level TEXT,
                gaps_count INTEGER,
                critical_gaps INTEGER,
                shadow_ai_count INTEGER,
                applicable_laws_count INTEGER,
                processing_time_ms INTEGER,
                report_id TEXT,
                status TEXT DEFAULT 'completed'
            );

            CREATE TABLE IF NOT EXISTS scan_gaps (
                id TEXT PRIMARY KEY,
                scan_id TEXT NOT NULL,
                tool_name TEXT,
                severity TEXT,
                gap_description TEXT,
                required_action TEXT,
                estimated_fix_time TEXT,
                FOREIGN KEY (scan_id) REFERENCES scans(id)
            );

            CREATE TABLE IF NOT EXISTS scan_laws (
                id TEXT PRIMARY KEY,
                scan_id TEXT NOT NULL,
                law_id TEXT,
                law_name TEXT,
                jurisdiction TEXT,
                confidence REAL,
                FOREIGN KEY (scan_id) REFERENCES scans(id)
            );

            CREATE TABLE IF NOT EXISTS npi_lookups (
                npi TEXT,
                looked_up_at TEXT,
                hospital_name TEXT,
                found INTEGER,
                state TEXT
            );
        """)
    print(f"[ClearPath] Audit DB initialized at {DB_PATH}")

def log_npi_lookup(npi: str, result: dict):
    """Log every NPI lookup for analytics."""
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO npi_lookups VALUES (?, ?, ?, ?, ?)",
            (npi, _now(), result.get("hospital",""), 1 if result.get("found") else 0, result.get("city",""))
        )

def log_scan(scan_type: str, inputs: dict, outputs: dict, processing_ms: int) -> str:
    """Log a completed scan. Returns the audit record ID."""
    audit_id = str(uuid.uuid4())
    report = outputs.get("hospital_report", outputs)
    gaps = report.get("compliance_gaps", [])
    laws = report.get("applicable_laws", [])

    with _get_conn() as conn:
        conn.execute("""
            INSERT INTO scans VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            audit_id, _now(), scan_type,
            inputs.get("hospital_npi"), inputs.get("hospital_name"),
            inputs.get("state"), inputs.get("hospital_type"), inputs.get("hospital_size"),
            len(inputs.get("ai_tools", [])), json.dumps(inputs.get("ai_tools", [])),
            report.get("overall_compliance_score"),
            report.get("overall_risk_level"),
            len(gaps),
            sum(1 for g in gaps if g.get("severity") == "critical"),
            len(report.get("shadow_ai_risks", [])),
            len(laws), processing_ms,
            report.get("report_id"), "completed"
        ))

        for gap in gaps:
            conn.execute(
                "INSERT INTO scan_gaps VALUES (?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), audit_id, gap.get("tool_name"), gap.get("severity"),
                 gap.get("gap_description"), gap.get("required_action"), gap.get("estimated_fix_time"))
            )

        for law in laws:
            conn.execute(
                "INSERT INTO scan_laws VALUES (?,?,?,?,?,?)",
                (str(uuid.uuid4()), audit_id, law.get("law_id"), law.get("law_name"),
                 law.get("jurisdiction"), law.get("confidence"))
            )

    return audit_id

def get_audit_report(audit_id: str) -> dict:
    """Retrieve a full audit record by ID."""
    with _get_conn() as conn:
        scan = conn.execute("SELECT * FROM scans WHERE id = ?", (audit_id,)).fetchone()
        if not scan:
            return {}
        gaps = conn.execute("SELECT * FROM scan_gaps WHERE scan_id = ?", (audit_id,)).fetchall()
        laws = conn.execute("SELECT * FROM scan_laws WHERE scan_id = ?", (audit_id,)).fetchall()
        return {
            "audit_id": audit_id,
            "scan": dict(scan),
            "gaps": [dict(g) for g in gaps],
            "laws": [dict(l) for l in laws],
        }

def get_scan_history(hospital_npi: str = None, limit: int = 20) -> list:
    """Get scan history, optionally filtered by NPI."""
    with _get_conn() as conn:
        if hospital_npi:
            rows = conn.execute(
                "SELECT * FROM scans WHERE hospital_npi = ? ORDER BY created_at DESC LIMIT ?",
                (hospital_npi, limit)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM scans ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

def get_stats() -> dict:
    """Platform-wide stats."""
    with _get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM scans").fetchone()[0]
        avg_score = conn.execute("SELECT AVG(compliance_score) FROM scans WHERE compliance_score IS NOT NULL").fetchone()[0]
        critical = conn.execute("SELECT SUM(critical_gaps) FROM scans").fetchone()[0] or 0
        states = conn.execute("SELECT COUNT(DISTINCT hospital_state) FROM scans").fetchone()[0]
        return {
            "total_scans": total,
            "avg_compliance_score": round(avg_score, 1) if avg_score else 0,
            "total_critical_gaps_found": critical,
            "states_covered": states,
        }

def _now():
    return datetime.now(timezone.utc).isoformat()

# Auto-initialize on import
init_db()
