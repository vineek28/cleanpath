"""
ClearPath EHR Upload Parser
============================
Parses hospital-uploaded CSV/Excel files into patient encounters.
Accepts real EHR exports or our provided template.

Supported column names (case-insensitive, flexible):
  MRN, PATIENT_MRN, MEDICAL_RECORD_NUMBER
  ADM_ID, ADMISSION_ID, ENCOUNTER_ID
  FIRST_NAME, PATIENT_FIRST, FNAME
  LAST_NAME, PATIENT_LAST, LNAME
  AGE, PATIENT_AGE
  GENDER, SEX
  ADMISSION_DATE, ADMIT_DATE, ADM_DATE
  DISCHARGE_DATE, DISCH_DATE, DC_DATE
  DEPARTMENT, DEPT, CARE_UNIT
  ICD10_CODE, ICD10, DIAGNOSIS_CODE, PRIMARY_DIAGNOSIS
  ICD10_DESC, DIAGNOSIS, DIAGNOSIS_DESC
  DRG_CODE, DRG, MS_DRG
  AI_TOOLS_ACTIVE, AI_TOOLS, ACTIVE_AI_SYSTEMS
  GOVERNANCE_NOTES, NOTES
"""

import io
import csv
import json
import uuid
import sqlite3
import pandas as pd
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "clearpath_audit.db"

# Column name aliases — maps flexible column names to canonical names
COLUMN_ALIASES = {
    'mrn':              ['mrn','patient_mrn','medical_record_number','patient_id'],
    'adm_id':           ['adm_id','admission_id','encounter_id','visit_id','account_number'],
    'first_name':       ['first_name','patient_first','fname','given_name'],
    'last_name':        ['last_name','patient_last','lname','surname','family_name'],
    'age':              ['age','patient_age','age_years'],
    'gender':           ['gender','sex','patient_gender','patient_sex'],
    'admission_date':   ['admission_date','admit_date','adm_date','visit_date','encounter_date'],
    'discharge_date':   ['discharge_date','disch_date','dc_date','discharge'],
    'department':       ['department','dept','care_unit','unit','ward','service'],
    'icd10_primary':    ['icd10_code','icd10','diagnosis_code','primary_diagnosis','dx_code','icd_10'],
    'icd10_desc':       ['icd10_desc','diagnosis','diagnosis_desc','dx_description','diagnosis_description'],
    'drg':              ['drg_code','drg','ms_drg','drg_number'],
    'ai_tools_used':    ['ai_tools_active','ai_tools','active_ai_systems','ai_systems','tools_active'],
    'governance_notes': ['governance_notes','notes','comments','compliance_notes','governance_notes'],
    'ai_governance_status': ['ai_governance_status','governance_status','tool_governance'],
    'disclosure_sent':  ['disclosure_sent','disclosure_status','patient_notified'],
    'los_days':         ['los_days','length_of_stay','los'],
    'drg_name':         ['drg_desc','drg_name','drg_description'],
}

# Known AI tool name mappings from common EHR export formats
AI_TOOL_NORMALIZER = {
    'epic sepsis': 'epic_sepsis_model',
    'deterioration index': 'epic_sepsis_model',
    'epic deterioration': 'epic_sepsis_model',
    'nuance dax': 'nuance_dax',
    'dax': 'nuance_dax',
    'billing ai': 'billing_coding_ai',
    'ai coding': 'billing_coding_ai',
    'computer assisted coding': 'billing_coding_ai',
    'cac': 'billing_coding_ai',
    'radiology ai': 'radiology_ai_cad',
    'cade': 'radiology_ai_cad',
    'cad': 'radiology_ai_cad',
    'viz ai': 'viz_ai',
    'viz.ai': 'viz_ai',
    'chatgpt': 'chatgpt_clinical',
    'gpt': 'chatgpt_clinical',
    'openai': 'chatgpt_clinical',
    'optum': 'optum_claims_ai',
    'prior auth ai': 'optum_claims_ai',
    'azure openai': 'azure_openai_clinical',
    'epic predictive': 'ehr_predictive_analytics',
    'ehr analytics': 'ehr_predictive_analytics',
    'ambient': 'ambient_clinical_intelligence',
    'suki': 'ambient_clinical_intelligence',
    'abridge': 'ambient_clinical_intelligence',
}


def _normalize_column(col_name: str) -> str:
    """Map a flexible column name to canonical name."""
    col_lower = col_name.lower().strip().replace(' ','_').replace('-','_')
    for canonical, aliases in COLUMN_ALIASES.items():
        if col_lower in aliases or col_lower == canonical:
            return canonical
    return col_lower


def _normalize_ai_tools(tools_str: str) -> list:
    """Parse AI tools string into canonical tool IDs."""
    if not tools_str or pd.isna(tools_str):
        return []
    tools_str = str(tools_str)
    # Split on common delimiters
    raw_tools = [t.strip() for t in tools_str.replace(';',',').replace('|',',').split(',') if t.strip()]
    normalized = []
    for raw in raw_tools:
        raw_lower = raw.lower()
        matched = None
        for alias, canonical in AI_TOOL_NORMALIZER.items():
            if alias in raw_lower:
                matched = canonical
                break
        if matched and matched not in normalized:
            normalized.append(matched)
        elif not matched and raw_lower not in normalized:
            # Keep unknown tools as-is (lowercased, underscored)
            normalized.append(raw_lower.replace(' ','_'))
    return normalized


def parse_upload(file_content: bytes, filename: str, hospital_npi: str, hospital_name: str) -> dict:
    """
    Parse uploaded CSV or Excel file.
    Returns parsed rows with validation errors flagged.
    """
    # Parse file — supports CSV, Excel, JSON
    try:
        fname = filename.lower()
        if fname.endswith('.xlsx') or fname.endswith('.xls'):
            df = pd.read_excel(io.BytesIO(file_content), dtype=str)
        elif fname.endswith('.json'):
            import json as _json
            raw = _json.loads(file_content.decode('utf-8'))
            # Support both array of objects and {patients: [...]} format
            if isinstance(raw, list):
                df = pd.DataFrame(raw, dtype=str)
            elif isinstance(raw, dict) and 'patients' in raw:
                df = pd.DataFrame(raw['patients'], dtype=str)
            elif isinstance(raw, dict) and 'encounters' in raw:
                df = pd.DataFrame(raw['encounters'], dtype=str)
            else:
                df = pd.DataFrame([raw], dtype=str)
            df = df.astype(str)
        else:
            # Default: CSV (also handles TSV with sniffing)
            try:
                df = pd.read_csv(io.StringIO(file_content.decode('utf-8', errors='replace')), dtype=str)
            except Exception:
                df = pd.read_csv(io.StringIO(file_content.decode('utf-8', errors='replace')), sep='\t', dtype=str)
    except Exception as e:
        return {"success": False, "error": f"Could not parse file: {str(e)}"}

    if df.empty:
        return {"success": False, "error": "File appears to be empty"}

    # Normalize column names
    df.columns = [_normalize_column(c) for c in df.columns]

    # Check required columns
    required = ['mrn', 'icd10_primary']
    missing = [r for r in required if r not in df.columns]
    if missing:
        return {
            "success": False,
            "error": f"Missing required columns: {', '.join(missing)}. Please use our template.",
            "detected_columns": list(df.columns),
        }

    # Parse rows
    patients = []
    errors = []
    for idx, row in df.iterrows():
        try:
            mrn = str(row.get('mrn','')).strip().upper()
            if not mrn or mrn == 'NAN':
                errors.append(f"Row {idx+2}: Missing MRN — skipped")
                continue

            ai_tools = _normalize_ai_tools(row.get('ai_tools_used',''))

            patient = {
                "id":               str(uuid.uuid4()),
                "hospital_npi":     hospital_npi,
                "hospital_name":    hospital_name,
                "mrn":              mrn,
                "adm_id":           str(row.get('adm_id', f'ADM-{uuid.uuid4().hex[:6].upper()}')).strip(),
                "first_name":       str(row.get('first_name', 'Patient')).strip(),
                "last_name":        str(row.get('last_name', f'#{idx+1}')).strip(),
                "age":              int(float(row.get('age', 55))) if str(row.get('age','')).replace('.','').isdigit() else 55,
                "gender":           str(row.get('gender', 'U')).strip()[:1].upper(),
                "admission_date":   str(row.get('admission_date', '2025-01-01')).strip()[:10],
                "discharge_date":   str(row.get('discharge_date', '')).strip()[:10] or '',
                "los_days":         0.0,
                "department":       str(row.get('department', 'General Medicine')).strip(),
                "archetype":        "Uploaded Encounter",
                "drg":              str(row.get('drg', '')).strip(),
                "drg_name":         "",
                "icd10_primary":    str(row.get('icd10_primary', '')).strip(),
                "icd10_desc":       str(row.get('icd10_desc', 'Diagnosis not specified')).strip(),
                "ai_tools_used":    json.dumps(ai_tools),
                "governance_gaps":  json.dumps([]),
                "risk_level":       "medium",  # will be updated by compliance engine
                "disclosure_status":"pending",
                "ai_tools_count":   len(ai_tools),
                "gaps_count":       0,
                "created_at":       datetime.now(timezone.utc).isoformat(),
                "report_generated": False,
                "clinical_notes":   str(row.get('governance_notes', '')).strip(),
                "batch_id":         None,
                "source":           "upload",
            }
            patients.append(patient)
        except Exception as e:
            errors.append(f"Row {idx+2}: Parse error — {str(e)}")

    return {
        "success": True,
        "total_rows": len(df),
        "parsed":     len(patients),
        "errors":     errors,
        "patients":   patients,
        "columns_detected": list(df.columns),
        "preview": patients[:5],  # first 5 for preview
    }


def save_uploaded_patients(patients: list, hospital_npi: str) -> str:
    """Save parsed patients to DB and return batch_id."""
    from services.synthetic_data import init_patient_tables
    init_patient_tables()

    batch_id = str(uuid.uuid4())
    with sqlite3.connect(DB_PATH) as conn:
        # Clear existing uploaded patients for this hospital
        conn.execute("DELETE FROM patient_encounters WHERE hospital_npi = ? AND source = 'upload'", (hospital_npi,))
        
        # Add source column if it doesn't exist
        try:
            conn.execute("ALTER TABLE patient_encounters ADD COLUMN source TEXT DEFAULT 'synthetic'")
        except Exception:
            pass

        for p in patients:
            p["batch_id"] = batch_id
            conn.execute("""
                INSERT OR REPLACE INTO patient_encounters (
                    id,hospital_npi,hospital_name,mrn,adm_id,first_name,last_name,
                    age,gender,admission_date,discharge_date,los_days,department,
                    archetype,drg,drg_name,icd10_primary,icd10_desc,ai_tools_used,
                    governance_gaps,risk_level,disclosure_status,ai_tools_count,
                    gaps_count,created_at,report_generated,clinical_notes,batch_id
                ) VALUES (
                    :id,:hospital_npi,:hospital_name,:mrn,:adm_id,:first_name,:last_name,
                    :age,:gender,:admission_date,:discharge_date,:los_days,:department,
                    :archetype,:drg,:drg_name,:icd10_primary,:icd10_desc,:ai_tools_used,
                    :governance_gaps,:risk_level,:disclosure_status,:ai_tools_count,
                    :gaps_count,:created_at,:report_generated,:clinical_notes,:batch_id
                )
            """, p)

    return batch_id
