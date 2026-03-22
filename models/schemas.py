from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class SeverityLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class RiskLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class HospitalType(str, Enum):
    ACADEMIC_MEDICAL_CENTER = "academic_medical_center"
    COMMUNITY_HOSPITAL = "community_hospital"
    CRITICAL_ACCESS = "critical_access"
    SPECIALTY = "specialty"
    CHILDRENS = "childrens"
    PSYCHIATRIC = "psychiatric"
    REHABILITATION = "rehabilitation"
    OTHER = "other"


class HospitalSize(str, Enum):
    SMALL = "small"       # < 100 beds
    MEDIUM = "medium"     # 100-499 beds
    LARGE = "large"       # 500+ beds
    SYSTEM = "system"     # Multi-hospital health system


# ─── INPUT MODELS ────────────────────────────────────────────────────────────

class HospitalInput(BaseModel):
    state: str = Field(..., description="US state (e.g., 'texas', 'california')")
    hospital_name: Optional[str] = Field(None, description="Name of the hospital")
    hospital_type: HospitalType = Field(HospitalType.COMMUNITY_HOSPITAL)
    hospital_size: HospitalSize = Field(HospitalSize.MEDIUM)
    ai_tools: List[str] = Field(..., description="List of AI tool IDs or names in use")
    accepts_medicare_medicaid: bool = Field(True)
    additional_context: Optional[str] = Field(None)


class PatientInput(BaseModel):
    hospital_name: Optional[str] = Field(None)
    hospital_state: str = Field(..., description="State where care was received")
    visit_type: str = Field(..., description="e.g., 'emergency', 'inpatient', 'outpatient', 'telehealth'")
    visit_summary: Optional[str] = Field(None, description="Optional: patient's visit summary text")
    ai_tools_mentioned: Optional[List[str]] = Field(default_factory=list)


# ─── AGENT OUTPUT MODELS ──────────────────────────────────────────────────────

class ApplicableLaw(BaseModel):
    law_id: str
    law_name: str
    jurisdiction: str  # "state" or "federal"
    effective_date: str
    applies_because: str
    key_requirements: List[str]
    penalty_summary: str
    source_url: Optional[str] = None
    confidence: float = Field(..., ge=0.0, le=1.0)


class LawMapperOutput(BaseModel):
    state: str
    applicable_laws: List[ApplicableLaw]
    total_laws_applicable: int
    highest_risk_law: str
    summary: str
    agent: str = "law_mapper"


class ComplianceGap(BaseModel):
    gap_id: str
    tool_name: str
    law_violated: str
    requirement_id: str
    gap_description: str
    severity: SeverityLevel
    required_action: str
    estimated_fix_time: str
    documentation_needed: List[str]
    confidence: float = Field(..., ge=0.0, le=1.0)


class GapScannerOutput(BaseModel):
    hospital_id: Optional[str]
    compliance_gaps: List[ComplianceGap]
    overall_compliance_score: int = Field(..., ge=0, le=100)
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    immediate_actions_required: List[str]
    estimated_total_fix_time: str
    agent: str = "gap_scanner"


class ShadowAIRisk(BaseModel):
    risk_id: str
    risk_description: str
    likely_tools: List[str]
    evidence_basis: str
    severity: SeverityLevel
    confidence: float = Field(..., ge=0.0, le=1.0)
    recommended_action: str


class ShadowAIOutput(BaseModel):
    shadow_ai_risks: List[ShadowAIRisk]
    shadow_ai_risk_level: RiskLevel
    undeclared_tool_suspects: List[str]
    recommendation: str
    shadow_ai_policy_exists: Optional[bool] = None
    agent: str = "shadow_ai_detector"


class PatientRight(BaseModel):
    right_title: str
    description: str
    how_to_exercise: str


class PatientTransparencyOutput(BaseModel):
    headline: str
    what_ai_did: str
    why_it_was_used: str
    did_ai_affect_decisions: bool
    confidence_in_ai_use: str
    your_rights: List[PatientRight]
    questions_to_ask_doctor: List[str]
    reassurance_note: str
    additional_resources: List[str]
    agent: str = "patient_transparency"


class ValidationIssue(BaseModel):
    issue_type: str
    description: str
    affected_agents: List[str]
    severity: SeverityLevel
    correction_applied: Optional[str] = None


class SafetyCheckerOutput(BaseModel):
    validation_passed: bool
    issues_found: List[ValidationIssue]
    corrections_made: List[str]
    final_risk_level: RiskLevel
    safe_to_display: bool
    validation_notes: str
    agent: str = "safety_checker"


# ─── ORCHESTRATOR OUTPUT (FINAL RESPONSE) ────────────────────────────────────

class ActionItem(BaseModel):
    priority: int
    action: str
    owner: str
    deadline: str
    law_reference: Optional[str] = None


class HospitalReport(BaseModel):
    report_id: str
    generated_at: str
    hospital_name: Optional[str]
    state: str
    executive_summary: str
    overall_compliance_score: int
    overall_risk_level: RiskLevel
    applicable_laws_count: int
    critical_gaps_count: int
    applicable_laws: List[ApplicableLaw]
    compliance_gaps: List[ComplianceGap]
    shadow_ai_risks: List[ShadowAIRisk]
    action_checklist: List[ActionItem]
    next_steps: List[str]
    disclaimer: str


class PatientReport(BaseModel):
    report_id: str
    generated_at: str
    hospital_name: Optional[str]
    headline: str
    ai_summary: str
    what_happened: str
    your_rights: List[PatientRight]
    questions_to_ask: List[str]
    reassurance: str
    state_protections: List[str]
    resources: List[str]
    disclaimer: str


class ClearPathResponse(BaseModel):
    success: bool
    request_id: str
    processing_time_ms: float
    hospital_report: Optional[HospitalReport] = None
    patient_report: Optional[PatientReport] = None
    validation: SafetyCheckerOutput
    error: Optional[str] = None


# ─── GRAPH STATE ──────────────────────────────────────────────────────────────

class GraphState(BaseModel):
    """LangGraph state passed between nodes."""
    # Inputs
    hospital_input: Optional[HospitalInput] = None
    patient_input: Optional[PatientInput] = None
    request_type: str = "hospital"  # "hospital" | "patient" | "both"
    request_id: str = ""

    # Agent outputs (populated as graph runs)
    law_mapper_output: Optional[Dict[str, Any]] = None
    gap_scanner_output: Optional[Dict[str, Any]] = None
    shadow_ai_output: Optional[Dict[str, Any]] = None
    patient_transparency_output: Optional[Dict[str, Any]] = None
    safety_checker_output: Optional[Dict[str, Any]] = None

    # Final
    hospital_report: Optional[Dict[str, Any]] = None
    patient_report: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    completed: bool = False

    class Config:
        arbitrary_types_allowed = True
