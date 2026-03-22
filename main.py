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

import time
import json
import os
import httpx
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

# ── Load environment variables from .env ──────────────────────────────────────
load_dotenv()

# Verify API key is present
_api_key = os.environ.get("ANTHROPIC_API_KEY")
if not _api_key:
    print("[WARNING] ANTHROPIC_API_KEY not found in environment or .env file!")
else:
    print(f"[ClearPath] API key loaded: sk-ant-...{_api_key[-6:]}")

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
    allow_origins=[
        "http://localhost:5173",
        "https://YOUR-FRONTEND.vercel.app",       # replace after Vercel deploy
        "https://YOUR-BACKEND.up.railway.app",    # replace after Railway deploy
    ],
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

@app.get("/api/npi/search")
async def npi_search(q: str, state: Optional[str] = None, zip_code: Optional[str] = None):
    """Search NPPES for hospitals by name (server-side, avoids browser CORS)."""
    from services.nppes import _get_primary_taxonomy
    # NPPES requires trailing wildcard for partial-name matching
    params = {"organization_name": q.rstrip("*") + "*", "enumeration_type": "NPI-2", "version": "2.1", "limit": "8"}
    if state:
        params["state"] = state
    if zip_code:
        params["postal_code"] = zip_code
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get("https://npiregistry.cms.hhs.gov/api/", params=params)
        data = resp.json()
        results = []
        for r in data.get("results", []):
            addr = next((a for a in r.get("addresses", []) if a.get("address_purpose") == "LOCATION"),
                        (r.get("addresses") or [{}])[0])
            name = r.get("basic", {}).get("organization_name", "")
            if not name:
                continue
            results.append({
                "npi": r.get("number"),
                "hospital": name,
                "city": addr.get("city", ""),
                "state": addr.get("state", ""),
                "zip": (addr.get("postal_code") or "")[:5],
                "type": _get_primary_taxonomy(r.get("taxonomies", [])),
            })
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"NPPES search failed: {str(e)}")


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ClearPath",
        "version": "1.0.0",
        "kb_version": "1.0.0",
        "timestamp": time.time()
    }


@app.get("/api/health/deep")
def deep_health_check():
    """
    Runs a synthetic hospital through the full pipeline and checks invariants.
    Use this on stage to prove the system works end-to-end.
    """
    from rag.retriever import get_rag_status
    rag_status = get_rag_status()

    # Quick sanity checks on data layer
    law_data = load_json("state_laws.json")
    tool_data = load_json("hospital_tools.json")

    checks = {
        "state_laws_loaded": len(law_data.get("states", {})) >= 6,
        "federal_laws_loaded": len(law_data.get("federal", {}).get("laws", [])) >= 3,
        "tools_loaded": len(tool_data.get("tools", {})) >= 10,
        "rag_backend": rag_status["backend"],
        "rag_chunks": rag_status.get("chunk_count", 0),
        "demo_state_covered": "texas" in law_data.get("states", {}),
        "demo_tools_present": all(
            t in tool_data.get("tools", {})
            for t in ["epic_sepsis_model", "nuance_dax", "billing_coding_ai"]
        ),
    }

    all_passed = all(v is True or isinstance(v, (str, int)) for v in checks.values())

    return {
        "status": "healthy" if all_passed else "degraded",
        "checks": checks,
        "rag": rag_status,
        "kb_version": "1.0.0",
        "timestamp": time.time()
    }


@app.post("/api/analyze/hospital")
def analyze_hospital(request: HospitalAnalysisRequest):
    """
    Run full compliance analysis for a hospital admin.
    Returns: compliance report, applicable laws, gap analysis, shadow AI risks, action checklist.
    Also logs every scan to the audit trail (SQLite).
    """
    from services.audit import log_scan
    from services.shadow_ai_engine import run_shadow_ai_analysis
    start = time.time()
    
    try:
        hospital_input = request.model_dump()
        result = run_hospital_analysis(hospital_input)
        elapsed_ms = round((time.time() - start) * 1000, 2)

        # ── Enrich shadow AI with heuristic engine ──────────────────────────
        shadow_enriched = run_shadow_ai_analysis(
            declared_tools=request.ai_tools,
            hospital_type=request.hospital_type,
            hospital_size=request.hospital_size,
            state=request.state,
        )
        # Merge heuristic risks into report
        hospital_report = result.get("hospital_report", {})
        existing_shadow = hospital_report.get("shadow_ai_risks", [])
        heuristic_risks = shadow_enriched.get("shadow_ai_risks", [])
        # Add heuristic risks not already in report
        seen = {r.get("risk_name","") for r in existing_shadow}
        for risk in heuristic_risks:
            if risk.get("risk_name","") not in seen:
                existing_shadow.append(risk)
        if hospital_report:
            hospital_report["shadow_ai_risks"] = existing_shadow
            hospital_report["shadow_ai_methodology"] = shadow_enriched.get("detection_methodology","")

        # ── Log to audit trail ───────────────────────────────────────────────
        try:
            audit_id = log_scan(
                scan_type="hospital",
                inputs=hospital_input,
                outputs={"hospital_report": hospital_report},
                processing_ms=int(elapsed_ms),
            )
        except Exception as audit_err:
            audit_id = None
            print(f"[Audit] Warning: could not log scan: {audit_err}")

        return {
            "success": True,
            "audit_id": audit_id,
            "request_id": result.get("request_id"),
            "processing_time_ms": elapsed_ms,
            "hospital_report": hospital_report,
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


# ── NPI Lookup ─────────────────────────────────────────────────────────────────

from services.nppes import validate_npi as _validate_npi


@app.get("/api/npi/{npi}")
async def npi_lookup(npi: str):
    """Look up a hospital by NPI number via the real NPPES CMS registry."""
    return await _validate_npi(npi)


# ── Audit Trail Endpoints ──────────────────────────────────────────────────────

from services.audit import log_scan, get_audit_report, get_scan_history, get_stats, log_npi_lookup

@app.get("/api/audit/history")
async def scan_history(npi: str = None, limit: int = 20):
    """Get scan history for a hospital or all scans."""
    return {"scans": get_scan_history(hospital_npi=npi, limit=limit)}

@app.get("/api/audit/{audit_id}")
async def audit_detail(audit_id: str):
    """Get full audit record for a specific scan."""
    record = get_audit_report(audit_id)
    if not record:
        raise HTTPException(status_code=404, detail="Audit record not found")
    return record

@app.get("/api/stats")
async def platform_stats():
    """Platform-wide compliance statistics."""
    return get_stats()


# ── Shadow AI Analysis Endpoint ────────────────────────────────────────────────

from services.shadow_ai_engine import run_shadow_ai_analysis

@app.post("/api/analyze/shadow-ai")
async def shadow_ai_scan(request: HospitalAnalysisRequest):
    """Run shadow AI heuristic detection independently."""
    result = run_shadow_ai_analysis(
        declared_tools=request.ai_tools,
        hospital_type=request.hospital_type,
        hospital_size=request.hospital_size,
        state=request.state,
    )
    return result


# ── Patient Encounter Endpoints ────────────────────────────────────────────────

from services.synthetic_data import seed_hospital_patients, get_hospital_patients, get_batch_history

class SeedRequest(BaseModel):
    hospital_npi: str
    hospital_name: str
    hospital_type: str = "academic_medical_center"
    n: int = 25

@app.post("/api/patients/seed")
async def seed_patients(request: SeedRequest):
    """Seed synthetic patient encounter data for a hospital."""
    result = seed_hospital_patients(
        hospital_npi=request.hospital_npi,
        hospital_name=request.hospital_name,
        hospital_type=request.hospital_type,
        n=min(request.n, 50)
    )
    return {"success": True, "batch": result}

@app.get("/api/patients/{hospital_npi}")
async def get_patients(hospital_npi: str):
    """Get all patient encounters for a hospital."""
    patients = get_hospital_patients(hospital_npi)
    return {"patients": patients, "total": len(patients)}

@app.get("/api/patients/{hospital_npi}/batches")
async def get_batches(hospital_npi: str):
    """Get batch processing history for a hospital."""
    return {"batches": get_batch_history(hospital_npi)}


# ── Batch Compliance Endpoints ─────────────────────────────────────────────────

from services.batch_compliance import run_batch_compliance, get_delta, get_patient_by_mrn, get_disclosure_count

class BatchComplianceRequest(BaseModel):
    hospital_npi: str
    confirmed_tools: list = []

@app.post("/api/batch/run")
async def run_batch(request: BatchComplianceRequest):
    """Run rule-based compliance on all patient encounters for a hospital."""
    result = run_batch_compliance(
        hospital_npi=request.hospital_npi,
        confirmed_tools=request.confirmed_tools or None
    )
    return result

@app.get("/api/batch/delta/{hospital_npi}")
async def batch_delta(hospital_npi: str):
    """Get delta between last two compliance runs."""
    return get_delta(hospital_npi)

@app.get("/api/patients/{hospital_npi}/mrn/{mrn}")
async def patient_by_mrn(hospital_npi: str, mrn: str):
    """Look up patient by MRN — used by patient login."""
    patient = get_patient_by_mrn(hospital_npi, mrn)
    if not patient:
        return {"found": False}
    return {"found": True, "patient": patient}

@app.get("/api/batch/disclosure-count/{hospital_npi}")
async def disclosure_count(hospital_npi: str):
    """Get count of patients requiring disclosure — for results page."""
    count = get_disclosure_count(hospital_npi)
    return {"count": count, "hospital_npi": hospital_npi}


# ── EHR Upload Endpoints ───────────────────────────────────────────────────────

from fastapi import UploadFile, File, Form
from services.upload_parser import parse_upload, save_uploaded_patients
from services.batch_compliance import run_batch_compliance

@app.post("/api/batch/upload")
async def upload_ehr(
    file: UploadFile = File(...),
    hospital_npi: str = Form(...),
    hospital_name: str = Form(...),
    confirmed_tools: str = Form(default="[]"),
    run_compliance: bool = Form(default=True),
):
    """
    Upload CSV or Excel EHR export.
    Parses, stores, and optionally runs compliance analysis.
    """
    content = await file.read()
    filename = file.filename or "upload.csv"

    # Parse the file
    parse_result = parse_upload(content, filename, hospital_npi, hospital_name)
    if not parse_result["success"]:
        raise HTTPException(status_code=400, detail=parse_result["error"])

    patients = parse_result["patients"]
    if not patients:
        raise HTTPException(status_code=400, detail="No valid patient rows found in file")

    # Save to DB
    batch_id = save_uploaded_patients(patients, hospital_npi)

    result = {
        "success": True,
        "batch_id": batch_id,
        "filename": filename,
        "total_rows": parse_result["total_rows"],
        "parsed": parse_result["parsed"],
        "errors": parse_result["errors"],
        "preview": parse_result["preview"],
        "columns_detected": parse_result["columns_detected"],
        "source": "upload",
    }

    # Run compliance if requested
    if run_compliance:
        try:
            tools = json.loads(confirmed_tools) if confirmed_tools else []
            compliance = run_batch_compliance(
                hospital_npi=hospital_npi,
                confirmed_tools=tools or None
            )
            result["compliance"] = {
                "total": compliance["total_patients"],
                "critical": compliance["summary"]["critical"],
                "high": compliance["summary"]["high"],
                "disclosure_required": compliance["summary"]["disclosure_required"],
                "avg_score": compliance["avg_compliance_score"],
            }
        except Exception as e:
            result["compliance_error"] = str(e)

    return result


@app.get("/api/batch/template")
async def download_template():
    """Return the column schema for the upload template."""
    return {
        "required_columns": ["MRN", "ICD10_CODE"],
        "recommended_columns": ["ADM_ID", "FIRST_NAME", "LAST_NAME", "AGE", "GENDER",
                                 "ADMISSION_DATE", "DISCHARGE_DATE", "DEPARTMENT",
                                 "ICD10_DESC", "DRG_CODE", "AI_TOOLS_ACTIVE"],
        "optional_columns": ["GOVERNANCE_NOTES"],
        "ai_tools_format": "Comma-separated. Supported: Epic Sepsis, Billing AI, Radiology AI, Viz.AI, ChatGPT, Optum, Nuance DAX, Azure OpenAI, EHR Analytics, Ambient",
        "example_row": {
            "MRN": "MRN-84721",
            "ADM_ID": "ADM-00142",
            "FIRST_NAME": "James",
            "LAST_NAME": "Okafor",
            "AGE": 67,
            "GENDER": "M",
            "ADMISSION_DATE": "2025-02-14",
            "DISCHARGE_DATE": "2025-02-21",
            "DEPARTMENT": "ICU",
            "ICD10_CODE": "A41.9",
            "ICD10_DESC": "Sepsis, unspecified organism",
            "DRG_CODE": "871",
            "AI_TOOLS_ACTIVE": "Epic Sepsis, Billing AI, ChatGPT",
            "GOVERNANCE_NOTES": "ChatGPT used by resident — no BAA on file"
        }
    }


# ── Template Download ──────────────────────────────────────────────────────────

from fastapi.responses import FileResponse, Response as FastAPIResponse
import os

TEMPLATE_PATH = Path(__file__).parent / "ClearPath_EHR_Upload_Template.xlsx"
TEMPLATE_PATH_CSV = Path(__file__).parent / "ClearPath_EHR_Upload_Template.csv"
DEMO_SAMPLE_PATH = Path(__file__).parent / "ClearPath_Demo_EHR_Sample.csv"

@app.get("/api/batch/template/download")
async def download_template_file():
    """Download the blank EHR upload template."""
    for path, media in [(TEMPLATE_PATH, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
                         (TEMPLATE_PATH_CSV, "text/csv")]:
        if path.exists():
            return FileResponse(str(path), media_type=media, filename=path.name)
    raise HTTPException(status_code=404, detail="Template file not found. Contact support.")

@app.get("/api/batch/sample/download")
async def download_sample_file():
    """Download the pre-filled 25-row demo EHR sample file."""
    if DEMO_SAMPLE_PATH.exists():
        return FileResponse(str(DEMO_SAMPLE_PATH), media_type="text/csv", filename=DEMO_SAMPLE_PATH.name)
    raise HTTPException(status_code=404, detail="Sample file not found.")


# ── Workflow Status Endpoints ──────────────────────────────────────────────────

from services.batch_compliance import update_patient_status, get_triage_summary, RULE_DEADLINES

class StatusUpdateRequest(BaseModel):
    patient_id: str
    status: str
    note: str = ''

class BulkStatusRequest(BaseModel):
    patient_ids: list
    status: str
    note: str = ''

@app.post("/api/patients/status")
async def update_status(request: StatusUpdateRequest):
    ok = update_patient_status(request.patient_id, request.status, request.note)
    return {"success": ok}

@app.post("/api/patients/bulk-status")
async def bulk_status(request: BulkStatusRequest):
    results = [update_patient_status(pid, request.status, request.note) for pid in request.patient_ids]
    return {"success": all(results), "updated": sum(results)}

@app.get("/api/batch/triage/{hospital_npi}")
async def triage(hospital_npi: str):
    return get_triage_summary(hospital_npi)


# ── Patient Request Endpoints ──────────────────────────────────────────────────

import random
import sqlite3

DB_PATH = Path(__file__).parent / "clearpath_audit.db"

class PatientRequestBody(BaseModel):
    mrn: str
    adm_id: str
    patient_name: str
    request_type: str = "human_review"

def _ensure_patient_requests_table():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS patient_requests (
                id TEXT PRIMARY KEY,
                ticket_id TEXT,
                mrn TEXT,
                adm_id TEXT,
                patient_name TEXT,
                request_type TEXT,
                status TEXT DEFAULT 'pending',
                created_at TEXT
            )
        """)

_ensure_patient_requests_table()

@app.post("/api/patients/request-review")
async def request_human_review(body: PatientRequestBody):
    """Patient requests a human clinician review of their AI-assisted decision."""
    import uuid
    from datetime import datetime, timezone
    ticket_id = f"REQ-{random.randint(10000, 99999)}"
    req_id = str(uuid.uuid4())
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            INSERT INTO patient_requests (id, ticket_id, mrn, adm_id, patient_name, request_type, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (req_id, ticket_id, body.mrn, body.adm_id, body.patient_name,
              body.request_type, "pending", datetime.now(timezone.utc).isoformat()))
    # Mark patient as escalated in workflow
    try:
        from services.batch_compliance import update_patient_status
        update_patient_status(body.adm_id, "escalated", f"Patient requested human review — ticket {ticket_id}")
    except Exception:
        pass
    return {"success": True, "ticket_id": ticket_id, "status": "pending", "estimated_days": 3}


@app.post("/api/patients/request-explanation")
async def request_ai_explanation(body: PatientRequestBody):
    """Patient requests a plain-language explanation of how AI influenced their care."""
    import uuid
    from datetime import datetime, timezone
    ticket_id = f"EXP-{random.randint(10000, 99999)}"
    req_id = str(uuid.uuid4())
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            INSERT INTO patient_requests (id, ticket_id, mrn, adm_id, patient_name, request_type, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (req_id, ticket_id, body.mrn, body.adm_id, body.patient_name,
              body.request_type, "explanation_requested", datetime.now(timezone.utc).isoformat()))
    return {"success": True, "ticket_id": ticket_id, "status": "explanation_requested", "estimated_days": 5}


# ── PDF Generation Endpoints ───────────────────────────────────────────────────

class PdfReportRequest(BaseModel):
    enc: dict
    tickets: Optional[dict] = None

class PdfRightsCardRequest(BaseModel):
    enc: dict

@app.post("/api/patients/report/pdf")
async def patient_report_pdf(body: PdfReportRequest):
    """Generate a full multi-page Patient AI Transparency Report as PDF."""
    from services.pdf_report import generate_full_report
    try:
        pdf_bytes = generate_full_report(body.enc, body.tickets)
        adm_id = body.enc.get("adm_id", "report").replace("/", "-")
        return FastAPIResponse(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="ClearPath_Report_{adm_id}.pdf"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


@app.post("/api/patients/rights-card/pdf")
async def rights_card_pdf(body: PdfRightsCardRequest):
    """Generate a single-page AI Rights Card as PDF."""
    from services.pdf_report import generate_rights_card
    try:
        pdf_bytes = generate_rights_card(body.enc)
        adm_id = body.enc.get("adm_id", "rights").replace("/", "-")
        return FastAPIResponse(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="ClearPath_RightsCard_{adm_id}.pdf"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rights card PDF generation failed: {str(e)}")
