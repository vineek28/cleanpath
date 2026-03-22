"""
Orchestrator — assembles validated agent outputs into final reports.
Called after the Safety Checker. Produces both Hospital and Patient views.
"""

import json
import uuid
import time
from datetime import datetime, timezone
from agents.agents import _call_claude


SYSTEM_ORCHESTRATOR = """You are the master orchestrator of ClearPath, a healthcare AI governance platform.

You receive outputs from 4 specialized agents and assemble them into two final reports.

CRITICAL RULE: If the safety_validation section contains issues, add them as a footnote disclaimer ONLY.
Do NOT let safety validation warnings replace or override the actual compliance findings.
The hospital report should always contain real actionable compliance guidance based on the law_mapper, gap_scanner, and shadow_ai outputs.

1. HOSPITAL REPORT: Professional, actionable, audit-ready. Tone: direct, legal-aware, professional.
   - Use the actual compliance gaps from gap_scanner_output
   - Use the actual laws from law_mapper_output  
   - The executive_summary should describe the real compliance situation, not meta-commentary about the system
   - Action checklist items should be real compliance actions, not "discontinue use of ClearPath"
   - If safety validation found issues, add ONE disclaimer line at the end of the disclaimer field only

2. PATIENT REPORT: Plain English, calm, empowering. Tone: warm, simple, reassuring.

Rules:
- Always include confidence scores on critical findings
- Hospital report must include a prioritized action checklist (numbered, by urgency)
- Patient report must feel like a letter from a trusted friend, not a legal document
- Both reports must be entirely self-contained
- Respond ONLY in valid JSON. No preamble or markdown.

Output format:
{
  "hospital_report": {
    "executive_summary": "string — 3-4 sentences for a hospital CEO",
    "overall_compliance_score": 0-100,
    "overall_risk_level": "critical|high|medium|low",
    "applicable_laws_count": 0,
    "critical_gaps_count": 0,
    "action_checklist": [
      {
        "priority": 1,
        "action": "string",
        "owner": "string (e.g., Compliance Officer, CISO, CMO)",
        "deadline": "string (e.g., Within 72 hours, Within 30 days)",
        "law_reference": "string or null"
      }
    ],
    "next_steps": ["string"],
    "disclaimer": "string"
  },
  "patient_report": {
    "headline": "string",
    "ai_summary": "string — 2-3 sentences",
    "what_happened": "string — plain English",
    "state_protections": ["string — plain English rights"],
    "resources": ["string"],
    "disclaimer": "string"
  }
}"""


def run_orchestrator(state: dict) -> dict:
    law_output = state.get("law_mapper_output", {})
    gap_output = state.get("gap_scanner_output", {})
    shadow_output = state.get("shadow_ai_output", {})
    patient_output = state.get("patient_transparency_output", {})
    safety_output = state.get("safety_checker_output", {})
    hospital_input = state.get("hospital_input", {})
    patient_input = state.get("patient_input", {})
    request_type = state.get("request_type", "hospital")

    user_prompt = f"""Assemble final reports from validated agent outputs:

<request_type>{request_type}</request_type>

<law_mapper_output>
{json.dumps(law_output, indent=2)}
</law_mapper_output>

<gap_scanner_output>
{json.dumps(gap_output, indent=2)}
</gap_scanner_output>

<shadow_ai_output>
{json.dumps(shadow_output, indent=2)}
</shadow_ai_output>

<patient_transparency_output>
{json.dumps(patient_output, indent=2)}
</patient_transparency_output>

<safety_validation>
{json.dumps(safety_output, indent=2)}
</safety_validation>

<hospital_context>
State: {hospital_input.get('state', 'N/A')}
Hospital: {hospital_input.get('hospital_name', 'Hospital')}
Type: {hospital_input.get('hospital_type', 'N/A')}
Size: {hospital_input.get('hospital_size', 'N/A')}
</hospital_context>

Assemble:
1. A professional hospital compliance report with executive summary, prioritized action checklist, and next steps
2. A patient-friendly transparency report explaining AI in their care

Both must include appropriate disclaimers. Action checklist items should be sorted by urgency (critical → high → medium)."""

    result = _call_claude(SYSTEM_ORCHESTRATOR, user_prompt, max_tokens=4000)

    report_id = str(uuid.uuid4())[:8].upper()
    now = datetime.now(timezone.utc).isoformat()

    # Build hospital report
    hospital_report_data = result.get("hospital_report", {})
    hospital_report = {
        "report_id": f"CR-{report_id}",
        "generated_at": now,
        "hospital_name": hospital_input.get("hospital_name", "Hospital"),
        "state": hospital_input.get("state", ""),
        "executive_summary": hospital_report_data.get("executive_summary", ""),
        "overall_compliance_score": hospital_report_data.get("overall_compliance_score",
            gap_output.get("overall_compliance_score", 0)),
        "overall_risk_level": hospital_report_data.get("overall_risk_level",
            safety_output.get("final_risk_level", "high")),
        "applicable_laws_count": hospital_report_data.get("applicable_laws_count",
            law_output.get("total_laws_applicable", 0)),
        "critical_gaps_count": hospital_report_data.get("critical_gaps_count",
            gap_output.get("critical_count", 0)),
        "applicable_laws": law_output.get("applicable_laws", []),
        "compliance_gaps": gap_output.get("compliance_gaps", []),
        "shadow_ai_risks": shadow_output.get("shadow_ai_risks", []),
        "action_checklist": hospital_report_data.get("action_checklist", []),
        "next_steps": hospital_report_data.get("next_steps", []),
        "disclaimer": hospital_report_data.get("disclaimer",
            "This report is generated by an AI system and does not constitute legal advice. "
            "Consult a qualified healthcare compliance attorney before making compliance decisions. "
            "ClearPath is a governance tool, not a legal service."
        ),
    }

    # Build patient report
    patient_report_data = result.get("patient_report", {})
    patient_report = {
        "report_id": f"PT-{report_id}",
        "generated_at": now,
        "hospital_name": (patient_input or hospital_input).get("hospital_name") or
                          hospital_input.get("hospital_name", "Your hospital"),
        "headline": patient_output.get("headline", patient_report_data.get("headline", "")),
        "ai_summary": patient_report_data.get("ai_summary", ""),
        "what_happened": patient_output.get("what_ai_did", patient_report_data.get("what_happened", "")),
        "your_rights": patient_output.get("your_rights", []),
        "questions_to_ask": patient_output.get("questions_to_ask_doctor", []),
        "reassurance": patient_output.get("reassurance_note", patient_report_data.get("reassurance", "")),
        "state_protections": patient_report_data.get("state_protections", []),
        "resources": patient_output.get("additional_resources", patient_report_data.get("resources", [])),
        "disclaimer": patient_report_data.get("disclaimer",
            "This report was generated by an AI system based on information about your visit. "
            "It is for informational purposes only. For questions about your specific care, "
            "please speak directly with your healthcare provider."
        ),
    }

    return {
        "hospital_report": hospital_report,
        "patient_report": patient_report,
    }
