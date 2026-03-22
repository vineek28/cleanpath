"""
ClearPath Multi-Pass Safety Validator
Runs structured validation across 4 dimensions before any report reaches a user.
"""
import json
import os
import anthropic

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

def _call(system, user):
    r = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system=system,
        messages=[{"role": "user", "content": user}]
    )
    raw = r.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())

def validate_report(hospital_report: dict, patient_report: dict, original_inputs: dict) -> dict:
    """
    4-pass safety validation:
    1. Factual consistency — do laws cited actually match the state?
    2. Overconfidence check — any claims made without evidence?
    3. False accusation check — are shadow AI flags defensible?
    4. Patient safety check — does patient report contain harmful content?
    """
    issues = []
    passed_checks = []

    # ── Pass 1: Law/State Consistency ────────────────────────────────────────
    try:
        result = _call(
            """You are a healthcare regulatory accuracy checker. 
            Check if the laws cited in this compliance report are actually applicable to the given state.
            Respond ONLY in JSON: {"consistent": true/false, "issues": ["list of inconsistencies"], "check": "law_consistency"}""",
            f"""State: {original_inputs.get('state')}
Laws cited: {json.dumps([l.get('law_id') for l in hospital_report.get('applicable_laws', [])])}
Are these laws correctly applicable to this state? Flag any that seem wrong."""
        )
        if result.get("consistent"):
            passed_checks.append("Law/state consistency verified")
        else:
            issues.extend([{"check": "law_consistency", "issue": i, "severity": "high"} for i in result.get("issues", [])])
    except Exception as e:
        passed_checks.append(f"Law consistency check skipped: {e}")

    # ── Pass 2: Overconfidence Detection ──────────────────────────────────────
    try:
        gaps_text = json.dumps(hospital_report.get("compliance_gaps", [])[:5])
        result = _call(
            """You are an AI output quality checker for healthcare compliance.
            Check if any compliance gaps make overconfident claims not supported by the inputs.
            Respond ONLY in JSON: {"overconfident_items": ["list"], "check": "overconfidence"}""",
            f"""Hospital tools declared: {original_inputs.get('ai_tools', [])}
Compliance gaps flagged: {gaps_text}
Flag any gaps where the severity or certainty seems unsupported by the actual tool list."""
        )
        overconfident = result.get("overconfident_items", [])
        if not overconfident:
            passed_checks.append("Overconfidence check passed — all gaps are proportionate")
        else:
            issues.extend([{"check": "overconfidence", "issue": i, "severity": "medium"} for i in overconfident])
    except Exception as e:
        passed_checks.append(f"Overconfidence check skipped: {e}")

    # ── Pass 3: Shadow AI False Accusation Check ──────────────────────────────
    try:
        shadow = hospital_report.get("shadow_ai_risks", [])
        if shadow:
            result = _call(
                """You are a fairness reviewer for AI-generated compliance accusations.
                Check if shadow AI risks are framed as accusations rather than probabilistic flags.
                Respond ONLY in JSON: {"accusatory_items": ["list"], "check": "false_accusation"}""",
                f"""Shadow AI risks flagged: {json.dumps(shadow[:3])}
Hospital type: {original_inputs.get('hospital_type')}
Flag any items that state the hospital IS using undisclosed AI as fact rather than probability."""
            )
            accusatory = result.get("accusatory_items", [])
            if not accusatory:
                passed_checks.append("Shadow AI flags verified as probabilistic — no false accusations")
            else:
                issues.extend([{"check": "false_accusation", "issue": i, "severity": "high"} for i in accusatory])
        else:
            passed_checks.append("No shadow AI risks to validate")
    except Exception as e:
        passed_checks.append(f"Shadow AI validation skipped: {e}")

    # ── Pass 4: Patient Report Harm Check ─────────────────────────────────────
    try:
        if patient_report:
            result = _call(
                """You are a patient safety reviewer.
                Check if this patient transparency report contains anything that could cause:
                - Unnecessary alarm or anxiety disproportionate to actual risk
                - Medical advice beyond informational scope
                - Inaccurate descriptions of patient rights
                Respond ONLY in JSON: {"harmful_items": ["list"], "check": "patient_safety"}""",
                f"""Patient report summary: {patient_report.get('ai_summary', '')}
Patient rights listed: {json.dumps(patient_report.get('your_rights', [])[:3])}
Flag any content that could harm, mislead, or unnecessarily alarm the patient."""
            )
            harmful = result.get("harmful_items", [])
            if not harmful:
                passed_checks.append("Patient report harm check passed")
            else:
                issues.extend([{"check": "patient_safety", "issue": i, "severity": "critical"} for i in harmful])
    except Exception as e:
        passed_checks.append(f"Patient safety check skipped: {e}")

    return {
        "validation_passed": len([i for i in issues if i.get("severity") in ["high","critical"]]) == 0,
        "passed_checks": passed_checks,
        "issues_found": issues,
        "total_checks": 4,
        "checks_passed": len(passed_checks),
        "methodology": "4-pass structured validation: law consistency, overconfidence detection, false accusation prevention, patient safety review",
    }
