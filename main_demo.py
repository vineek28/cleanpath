"""
ClearPath — FastAPI Backend
Healthcare AI Governance Hub

Endpoints:
  POST /api/analyze/hospital   — Full compliance analysis for hospital admin
  POST /api/analyze/patient    — Patient transparency report
  POST /api/analyze/combined   — Both views simultaneously
  GET  /api/tools              — List known AI tools
  GET  /api/laws/{state}       — Laws applicable to a state
  GET  /api/health             — Health check
"""
from dotenv import load_dotenv
load_dotenv()


import time
import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from graph.pipeline import run_hospital_analysis, run_patient_analysis, run_combined_analysis
from models.schemas import HospitalInput, PatientInput

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ClearPath — Healthcare AI Governance Hub",
    description="Multi-agent platform for healthcare AI compliance and patient transparency",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent / "data"


def load_json(filename: str) -> dict:
    with open(DATA_DIR / filename) as f:
        return json.load(f)


# ── Request/Response models ───────────────────────────────────────────────────

class HospitalAnalysisRequest(BaseModel):
    state: str
    hospital_name: Optional[str] = None
    hospital_type: str = "community_hospital"
    hospital_size: str = "medium"
    ai_tools: List[str]
    accepts_medicare_medicaid: bool = True
    additional_context: Optional[str] = None


class PatientAnalysisRequest(BaseModel):
    hospital_state: str
    hospital_name: Optional[str] = None
    visit_type: str = "general"
    visit_summary: Optional[str] = None
    ai_tools_mentioned: Optional[List[str]] = []


class CombinedAnalysisRequest(BaseModel):
    hospital: HospitalAnalysisRequest
    patient: PatientAnalysisRequest


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ClearPath",
        "version": "1.0.0",
        "timestamp": time.time()
    }


@app.post("/api/analyze/hospital")
def analyze_hospital(request: HospitalAnalysisRequest):
    """
    Run full compliance analysis for a hospital admin.
    Returns: compliance report, applicable laws, gap analysis, shadow AI risks, action checklist.
    """
    start = time.time()
    
    try:
        hospital_input = request.model_dump()
        result = run_hospital_analysis(hospital_input)
        
        elapsed_ms = round((time.time() - start) * 1000, 2)
        
        return {
            "success": True,
            "request_id": result.get("request_id"),
            "processing_time_ms": elapsed_ms,
            "hospital_report": result.get("hospital_report"),
            "patient_report": result.get("patient_report"),
            "validation": result.get("safety_checker_output"),
            "agent_outputs": {
                "law_mapper": result.get("law_mapper_output"),
                "gap_scanner": result.get("gap_scanner_output"),
                "shadow_ai": result.get("shadow_ai_output"),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "error": str(e),
            "message": "Analysis failed. Please check your inputs and try again."
        })


@app.post("/api/analyze/patient")
def analyze_patient(request: PatientAnalysisRequest):
    """
    Generate a patient transparency report.
    Returns: plain-English explanation of AI used in care + patient rights.
    """
    start = time.time()
    
    try:
        patient_input = request.model_dump()
        result = run_patient_analysis(patient_input)
        
        elapsed_ms = round((time.time() - start) * 1000, 2)
        
        return {
            "success": True,
            "request_id": result.get("request_id"),
            "processing_time_ms": elapsed_ms,
            "patient_report": result.get("patient_report"),
            "validation": result.get("safety_checker_output"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "error": str(e),
            "message": "Patient report generation failed."
        })


@app.post("/api/analyze/combined")
def analyze_combined(request: CombinedAnalysisRequest):
    """
    Run both hospital compliance and patient transparency in a single call.
    This is the primary demo endpoint — shows both views simultaneously.
    """
    start = time.time()
    
    try:
        hospital_input = request.hospital.model_dump()
        patient_input = request.patient.model_dump()
        
        result = run_combined_analysis(hospital_input, patient_input)
        elapsed_ms = round((time.time() - start) * 1000, 2)
        
        return {
            "success": True,
            "request_id": result.get("request_id"),
            "processing_time_ms": elapsed_ms,
            "hospital_report": result.get("hospital_report"),
            "patient_report": result.get("patient_report"),
            "validation": result.get("safety_checker_output"),
            "agent_outputs": {
                "law_mapper": result.get("law_mapper_output"),
                "gap_scanner": result.get("gap_scanner_output"),
                "shadow_ai": result.get("shadow_ai_output"),
                "patient_transparency": result.get("patient_transparency_output"),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "error": str(e),
            "message": "Combined analysis failed."
        })


@app.get("/api/tools")
def get_known_tools():
    """List all AI tools in the reference database with risk profiles."""
    data = load_json("hospital_tools.json")
    tools = []
    for tool_id, tool in data["tools"].items():
        tools.append({
            "id": tool_id,
            "display_name": tool.get("display_name"),
            "vendor": tool.get("vendor"),
            "category": tool.get("category"),
            "risk_level": tool.get("risk_level"),
            "requires_disclosure": tool.get("requires_disclosure"),
            "phi_access": tool.get("phi_access"),
            "shadow_ai_risk": tool.get("shadow_ai_risk"),
        })
    return {
        "tools": tools,
        "total": len(tools),
        "risk_definitions": data.get("risk_level_definitions", {})
    }


@app.get("/api/laws/{state}")
def get_state_laws(state: str):
    """Return all laws applicable to a given state (state + federal)."""
    data = load_json("state_laws.json")
    state_key = state.lower().replace(" ", "_").replace("-", "_")
    
    state_data = data["states"].get(state_key)
    if not state_data:
        # Return federal laws only for unknown states
        return {
            "state": state,
            "note": "No state-specific AI laws found. Federal laws apply.",
            "state_laws": [],
            "federal_laws": data["federal"]["laws"],
            "covered_states": list(data["states"].keys())
        }
    
    applicability = data["law_applicability_matrix"].get(
        state_key, data["law_applicability_matrix"]["default"]
    )
    
    return {
        "state": state_data.get("display_name", state),
        "state_laws": state_data.get("laws", []),
        "federal_laws": data["federal"]["laws"],
        "applicability_summary": applicability,
        "total_laws": len(state_data.get("laws", [])) + len(data["federal"]["laws"])
    }


@app.get("/api/laws")
def get_all_covered_states():
    """Return list of all states with specific AI laws in the database."""
    data = load_json("state_laws.json")
    covered = []
    for state_key, state_data in data["states"].items():
        covered.append({
            "state_key": state_key,
            "display_name": state_data.get("display_name", state_key),
            "law_count": len(state_data.get("laws", [])),
            "laws": [law["id"] for law in state_data.get("laws", [])]
        })
    return {
        "covered_states": covered,
        "federal_laws": [law["id"] for law in data["federal"]["laws"]],
        "note": "Federal laws apply to all US states. All other states default to federal-only."
    }
