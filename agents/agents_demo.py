"""
ClearPath Agents — All 5 agents used in the LangGraph pipeline.

Each agent is a standalone async function that:
1. Takes a GraphState dict
2. Calls the Claude API with a structured prompt
3. Returns a parsed dict to be merged into state
"""

import json
import os
import asyncio
import anthropic
from typing import Any, Dict
from pathlib import Path

# ── Shared setup ──────────────────────────────────────────────────────────────

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

DATA_DIR = Path(__file__).parent.parent / "data"

def _load_json(filename: str) -> dict:
    with open(DATA_DIR / filename) as f:
        return json.load(f)

def _call_claude(system: str, user: str, max_tokens: int = 2000) -> dict:
    """Synchronous Claude API call expecting JSON response."""
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}]
    )
    raw = response.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


# ── AGENT 1: Law Mapper ───────────────────────────────────────────────────────

SYSTEM_LAW_MAPPER = """You are a healthcare AI regulatory expert. Your job is to identify which 
federal and state AI laws apply to a hospital based on their state and AI tools in use.

You have deep knowledge of:
- Texas TRAIGA (2026)
- California AB 489, SB 942, AB 2013 (2026)
- Colorado Artificial Intelligence Act (SB 24-205)
- Illinois Artificial Intelligence Act
- HIPAA AI Addendum (HHS Guidance)
- CMS AI Strategy requirements
- HHS AI Safety Program

Rules:
- Be precise. Only flag laws that genuinely apply based on the inputs.
- Include confidence scores (0.0-1.0) based on how clearly the law applies.
- Federal laws (HIPAA, CMS) apply to virtually all US hospitals that accept Medicare/Medicaid.
- Always explain WHY a law applies, not just that it does.
- Respond ONLY in valid JSON. No preamble, no markdown, no explanation outside JSON.

Output format:
{
  "state": "string",
  "applicable_laws": [
    {
      "law_id": "string",
      "law_name": "string", 
      "jurisdiction": "state|federal",
      "effective_date": "YYYY-MM-DD",
      "applies_because": "string",
      "key_requirements": ["string"],
      "penalty_summary": "string",
      "source_url": "string or null",
      "confidence": 0.0-1.0
    }
  ],
  "total_laws_applicable": 0,
  "highest_risk_law": "string",
  "summary": "string"
}"""


def run_law_mapper(state: dict) -> dict:
    hospital = state.get("hospital_input", {})
    law_data = _load_json("state_laws.json")
    
    # Pre-load relevant law context
    state_key = hospital.get("state", "").lower().replace(" ", "_")
    state_laws = law_data["states"].get(state_key, {}).get("laws", [])
    federal_laws = law_data["federal"]["laws"]
    applicability = law_data["law_applicability_matrix"].get(
        state_key, law_data["law_applicability_matrix"]["default"]
    )

    user_prompt = f"""Analyze which healthcare AI laws apply to this hospital:

<hospital_state>{hospital.get('state', 'unknown')}</hospital_state>
<hospital_type>{hospital.get('hospital_type', 'community_hospital')}</hospital_type>
<hospital_size>{hospital.get('hospital_size', 'medium')}</hospital_size>
<accepts_medicare_medicaid>{hospital.get('accepts_medicare_medicaid', True)}</accepts_medicare_medicaid>
<ai_tools_in_use>{json.dumps(hospital.get('ai_tools', []))}</ai_tools_in_use>

REFERENCE — State laws for {state_key}:
{json.dumps(state_laws, indent=2)}

REFERENCE — Federal laws that may apply:
{json.dumps(federal_laws, indent=2)}

REFERENCE — Known applicability matrix for {state_key}:
{json.dumps(applicability, indent=2)}

Based on this data, identify ALL applicable laws with confidence scores. Be thorough but precise."""

    result = _call_claude(SYSTEM_LAW_MAPPER, user_prompt, max_tokens=3000)
    result["agent"] = "law_mapper"
    return {"law_mapper_output": result}


# ── AGENT 2: Compliance Gap Scanner ──────────────────────────────────────────

SYSTEM_GAP_SCANNER = """You are a healthcare AI compliance auditor. You receive a list of laws 
that apply to a hospital and the AI tools they use, and you identify specific compliance gaps.

For each gap you find:
- Be specific: name the exact tool, the exact law, the exact requirement being violated
- Assign severity: critical (immediate legal/safety risk), high (30-day fix), medium (90-day), low (180-day)
- Assign confidence score (0.0-1.0): how certain you are this gap exists
- Recommend concrete actions, not vague advice
- Estimate realistic fix times

Rules:
- Do NOT flag issues with confidence below 0.4
- Do NOT make accusations without a documented basis
- High confidence (>0.8) only when the gap is clear and documented
- Include what documentation is needed to close the gap
- Respond ONLY in valid JSON. No preamble or markdown.

Output format:
{
  "hospital_id": "string or null",
  "compliance_gaps": [
    {
      "gap_id": "string",
      "tool_name": "string",
      "law_violated": "string",
      "requirement_id": "string",
      "gap_description": "string",
      "severity": "critical|high|medium|low",
      "required_action": "string",
      "estimated_fix_time": "string",
      "documentation_needed": ["string"],
      "confidence": 0.0-1.0
    }
  ],
  "overall_compliance_score": 0-100,
  "critical_count": 0,
  "high_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "immediate_actions_required": ["string"],
  "estimated_total_fix_time": "string"
}"""


def run_gap_scanner(state: dict) -> dict:
    hospital = state.get("hospital_input", {})
    law_output = state.get("law_mapper_output", {})
    tools_db = _load_json("hospital_tools.json")["tools"]

    # Build tool profiles for declared tools
    declared_tool_profiles = {}
    for tool_id in hospital.get("ai_tools", []):
        tool_key = tool_id.lower().replace(" ", "_").replace("-", "_")
        if tool_key in tools_db:
            declared_tool_profiles[tool_id] = tools_db[tool_key]
        else:
            declared_tool_profiles[tool_id] = {
                "display_name": tool_id,
                "risk_level": "unknown",
                "requires_baa": True,
                "description": "Tool not in reference database — manual review required",
                "governance_requirements": ["Manual compliance review required"],
                "commonly_undisclosed": True
            }

    user_prompt = f"""Scan for compliance gaps in this hospital's AI program:

<hospital_state>{hospital.get('state')}</hospital_state>
<hospital_size>{hospital.get('hospital_size')}</hospital_size>
<hospital_type>{hospital.get('hospital_type')}</hospital_type>
<accepts_medicare_medicaid>{hospital.get('accepts_medicare_medicaid', True)}</accepts_medicare_medicaid>

<applicable_laws>
{json.dumps(law_output.get('applicable_laws', []), indent=2)}
</applicable_laws>

<ai_tools_in_use>
{json.dumps(hospital.get('ai_tools', []))}
</ai_tools_in_use>

<tool_profiles>
{json.dumps(declared_tool_profiles, indent=2)}
</tool_profiles>

For each tool, check it against each applicable law's requirements. 
Flag every gap where the tool's known profile suggests non-compliance.
Be specific and evidence-based. Score the overall compliance 0-100."""

    result = _call_claude(SYSTEM_GAP_SCANNER, user_prompt, max_tokens=4000)
    result["agent"] = "gap_scanner"
    return {"gap_scanner_output": result}


# ── AGENT 3: Shadow AI Detector ───────────────────────────────────────────────

SYSTEM_SHADOW_AI = """You are an AI risk analyst specializing in identifying unauthorized 
("shadow") AI tool usage in healthcare organizations.

Shadow AI includes:
- Consumer AI chatbots (ChatGPT, Gemini, Copilot) used by clinical staff without governance
- Undeclared AI features within existing vendor contracts
- AI browser extensions on clinical workstations
- Undisclosed EHR AI modules activated by the vendor without hospital review

Rules:
- Do NOT accuse without evidence or reasonable basis
- Use confidence scores: only flag high-confidence risks (>0.6)
- Cross-reference declared tools vs common shadow AI patterns for similar hospital types
- Be specific about WHICH tools are likely shadow AI risks
- Respond ONLY in valid JSON. No preamble or markdown.

Output format:
{
  "shadow_ai_risks": [
    {
      "risk_id": "string",
      "risk_description": "string",
      "likely_tools": ["string"],
      "evidence_basis": "string",
      "severity": "critical|high|medium|low",
      "confidence": 0.0-1.0,
      "recommended_action": "string"
    }
  ],
  "shadow_ai_risk_level": "critical|high|medium|low",
  "undeclared_tool_suspects": ["string"],
  "recommendation": "string",
  "shadow_ai_policy_exists": null
}"""


def run_shadow_ai_detector(state: dict) -> dict:
    hospital = state.get("hospital_input", {})
    tools_db = _load_json("hospital_tools.json")

    shadow_patterns = tools_db["shadow_ai_patterns"]
    all_tools = tools_db["tools"]
    
    # Find tools with shadow_ai_indicator = True
    high_risk_tools = {k: v for k, v in all_tools.items() 
                       if v.get("shadow_ai_indicator", False)}

    user_prompt = f"""Analyze shadow AI risks for this hospital:

<declared_tools>{json.dumps(hospital.get('ai_tools', []))}</declared_tools>
<hospital_size>{hospital.get('hospital_size', 'medium')}</hospital_size>
<hospital_type>{hospital.get('hospital_type', 'community_hospital')}</hospital_type>
<state>{hospital.get('state')}</state>

REFERENCE — Known shadow AI patterns in healthcare:
{json.dumps(shadow_patterns, indent=2)}

REFERENCE — High-risk undisclosed tools commonly found in hospitals:
{json.dumps(high_risk_tools, indent=2)}

Based on the declared tools and hospital profile:
1. What shadow AI tools are likely in use but not declared?
2. Are any declared tools potentially being used in shadow/ungoverned ways?
3. What is the overall shadow AI risk level?

Remember: basis your findings on the hospital's type, size, and declared tools.
A large academic medical center has different shadow AI patterns than a small community hospital."""

    result = _call_claude(SYSTEM_SHADOW_AI, user_prompt, max_tokens=2000)
    result["agent"] = "shadow_ai_detector"
    return {"shadow_ai_output": result}


# ── AGENT 4: Patient Transparency Agent ──────────────────────────────────────

SYSTEM_PATIENT = """You explain AI in healthcare to patients in plain, calm, reassuring language.

Your rules:
- NEVER use medical or legal jargon
- NEVER alarm the patient — inform and empower
- NEVER guess about medical details — say clearly when you're uncertain
- Speak like a trusted friend who happens to know about healthcare technology
- Always tell them: what AI was used, why it was used, and what their rights are
- Always include practical questions they can ask their doctor
- Keep "your rights" grounded in what the patient's state actually requires

Tone: warm, honest, clear, empowering. NOT clinical, NOT legal, NOT scary.

Respond ONLY in valid JSON. No preamble or markdown.

Output format:
{
  "headline": "One sentence: plain English summary of AI in their care",
  "what_ai_did": "2-3 sentences max, plain English",
  "why_it_was_used": "1-2 sentences, simple reason",
  "did_ai_affect_decisions": true/false,
  "confidence_in_ai_use": "high|medium|low — how sure we are about what was used",
  "your_rights": [
    {
      "right_title": "string",
      "description": "plain English",
      "how_to_exercise": "practical step"
    }
  ],
  "questions_to_ask_doctor": ["string"],
  "reassurance_note": "string",
  "additional_resources": ["string"]
}"""


def run_patient_transparency(state: dict) -> dict:
    # Support both hospital flow and dedicated patient flow
    patient = state.get("patient_input", {})
    hospital = state.get("hospital_input", {})
    
    # Determine which state and tools to use
    care_state = (patient.get("hospital_state") or hospital.get("state", "unknown"))
    visit_type = patient.get("visit_type", "general visit")
    tools = (patient.get("ai_tools_mentioned") or hospital.get("ai_tools", []))
    visit_summary = patient.get("visit_summary", "")
    
    # Load state laws for patient rights
    law_data = _load_json("state_laws.json")
    state_key = care_state.lower().replace(" ", "_")
    patient_facing_requirements = []
    
    for state_data in law_data["states"].get(state_key, {}).get("laws", []):
        for req in state_data.get("requirements", []):
            if req.get("patient_facing"):
                patient_facing_requirements.append({
                    "law": state_data["id"],
                    "right": req["title"],
                    "description": req["description"]
                })

    user_prompt = f"""Explain AI use to a patient who received care:

<hospital_state>{care_state}</hospital_state>
<visit_type>{visit_type}</visit_type>
<ai_tools_used_in_care>{json.dumps(tools)}</ai_tools_used_in_care>
<visit_summary>{visit_summary or 'Not provided'}</visit_summary>

REFERENCE — Patient rights under {care_state} law (patient-facing requirements):
{json.dumps(patient_facing_requirements, indent=2)}

Create a patient transparency report that:
1. Explains in plain English what AI was used in their care
2. Explains why in simple terms
3. Lists their actual legal rights under {care_state} law
4. Gives them 3-5 questions to ask their doctor
5. Ends with a reassuring note

Remember: your audience has no medical or technical background. Write accordingly."""

    result = _call_claude(SYSTEM_PATIENT, user_prompt, max_tokens=2000)
    result["agent"] = "patient_transparency"
    return {"patient_transparency_output": result}


# ── AGENT 5: Safety + Conflict Checker ───────────────────────────────────────

SYSTEM_SAFETY = """You are the final validation layer for a healthcare AI governance platform.

Your job is to catch errors, contradictions, and unsafe outputs before they reach users.

Check for:
1. Contradictions between agents (e.g., law mapper says compliant, gap scanner says critical gap)
2. Overconfident claims (confidence > 0.9 on uncertain or novel topics)
3. Any output that could unfairly harm a hospital's reputation without solid evidence
4. Patient-facing content that could cause undue anxiety
5. Missing escalation flags for genuinely critical compliance issues
6. Hallucinated law names, requirement IDs, or penalty amounts
7. Inconsistent severity ratings across agents

Rules:
- If you correct something, explain what and why
- If validation_passed = false, list every issue clearly
- If safe_to_display = false, explain exactly what would need to change
- Respond ONLY in valid JSON. No preamble or markdown.

Output format:
{
  "validation_passed": true/false,
  "issues_found": [
    {
      "issue_type": "string",
      "description": "string",
      "affected_agents": ["string"],
      "severity": "critical|high|medium|low",
      "correction_applied": "string or null"
    }
  ],
  "corrections_made": ["string"],
  "final_risk_level": "critical|high|medium|low",
  "safe_to_display": true/false,
  "validation_notes": "string"
}"""


def run_safety_checker(state: dict) -> dict:
    user_prompt = f"""Validate all agent outputs for consistency and safety:

<law_mapper_output>
{json.dumps(state.get('law_mapper_output', {}), indent=2)}
</law_mapper_output>

<gap_scanner_output>
{json.dumps(state.get('gap_scanner_output', {}), indent=2)}
</gap_scanner_output>

<shadow_ai_output>
{json.dumps(state.get('shadow_ai_output', {}), indent=2)}
</shadow_ai_output>

<patient_transparency_output>
{json.dumps(state.get('patient_transparency_output', {}), indent=2)}
</patient_transparency_output>

Check for:
1. Are law citations real and accurate?
2. Do confidence scores reflect actual certainty?
3. Are there contradictions between agents?
4. Is patient content appropriately reassuring (not alarming)?
5. Are critical compliance gaps flagged at the right severity?
6. Would any output unfairly damage a hospital's reputation without solid evidence?

Return a comprehensive validation report."""

    result = _call_claude(SYSTEM_SAFETY, user_prompt, max_tokens=2000)
    result["agent"] = "safety_checker"
    return {"safety_checker_output": result}
