"""
Cross-verification test for ClearPath backend.
Run this BEFORE integrating with frontend.

Tests:
1. Data integrity — all JSON files load and are well-formed
2. State coverage — law matrix covers all expected states
3. Tool coverage — all tool IDs resolve correctly
4. Schema validation — sample inputs pass Pydantic validation
5. Data consistency — tools reference laws that exist in the law DB
6. Patient-facing flags — verify patient rights are marked correctly

Usage:
    cd clearpath
    python verify_data.py
"""

import json
import sys
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

PASS = "✅"
FAIL = "❌"
WARN = "⚠️ "

errors = []
warnings = []

def test(name: str, condition: bool, detail: str = ""):
    if condition:
        print(f"  {PASS} {name}")
    else:
        print(f"  {FAIL} {name}: {detail}")
        errors.append(f"{name}: {detail}")


def warn(name: str, detail: str):
    print(f"  {WARN} {name}: {detail}")
    warnings.append(f"{name}: {detail}")


# ── Test 1: File loading ──────────────────────────────────────────────────────
print("\n🔍 TEST 1: Data file loading")

try:
    with open(DATA_DIR / "state_laws.json") as f:
        laws_data = json.load(f)
    test("state_laws.json loads", True)
except Exception as e:
    test("state_laws.json loads", False, str(e))
    laws_data = {}

try:
    with open(DATA_DIR / "hospital_tools.json") as f:
        tools_data = json.load(f)
    test("hospital_tools.json loads", True)
except Exception as e:
    test("hospital_tools.json loads", False, str(e))
    tools_data = {}


# ── Test 2: Law data structure ────────────────────────────────────────────────
print("\n🔍 TEST 2: Law data structure")

expected_states = ["texas", "california", "colorado", "illinois", "new_york", "florida"]
for state in expected_states:
    has_state = state in laws_data.get("states", {})
    test(f"State covered: {state}", has_state)

has_federal = "federal" in laws_data and "laws" in laws_data["federal"]
test("Federal laws present", has_federal)

federal_law_ids = [l["id"] for l in laws_data.get("federal", {}).get("laws", [])]
for expected_id in ["HIPAA_AI", "CMS_AI_STRATEGY", "HHS_AI_SAFETY"]:
    test(f"Federal law exists: {expected_id}", expected_id in federal_law_ids)

has_matrix = "law_applicability_matrix" in laws_data
test("Applicability matrix present", has_matrix)


# ── Test 3: Law requirements have required fields ─────────────────────────────
print("\n🔍 TEST 3: Law requirement completeness")

required_req_fields = ["id", "category", "title", "description", "severity", "patient_facing"]
total_reqs = 0
missing_fields_count = 0

for state_key, state_data in laws_data.get("states", {}).items():
    for law in state_data.get("laws", []):
        for req in law.get("requirements", []):
            total_reqs += 1
            for field in required_req_fields:
                if field not in req:
                    missing_fields_count += 1

for law in laws_data.get("federal", {}).get("laws", []):
    for req in law.get("requirements", []):
        total_reqs += 1
        for field in required_req_fields:
            if field not in req:
                missing_fields_count += 1

test(f"All {total_reqs} requirements have required fields",
     missing_fields_count == 0,
     f"{missing_fields_count} missing fields")


# ── Test 4: Tool data structure ───────────────────────────────────────────────
print("\n🔍 TEST 4: Tool data structure")

required_tool_fields = ["display_name", "vendor", "category", "risk_level",
                         "requires_disclosure", "requires_baa", "phi_access",
                         "affects_clinical_decisions", "affects_billing",
                         "applicable_regulations", "governance_requirements"]

tools = tools_data.get("tools", {})
test(f"Tools database has entries", len(tools) > 0, f"Found {len(tools)} tools")

for tool_id, tool in tools.items():
    missing = [f for f in required_tool_fields if f not in tool]
    if missing:
        test(f"Tool {tool_id} has all fields", False, f"Missing: {missing}")

print(f"  {PASS} All {len(tools)} tools checked")

# Verify shadow AI patterns exist
has_patterns = "shadow_ai_patterns" in tools_data
test("Shadow AI patterns present", has_patterns)


# ── Test 5: Cross-reference tools → laws ─────────────────────────────────────
print("\n🔍 TEST 5: Cross-referencing tools → laws")

all_law_ids = set()
for state_data in laws_data.get("states", {}).values():
    for law in state_data.get("laws", []):
        all_law_ids.add(law["id"])
for law in laws_data.get("federal", {}).get("laws", []):
    all_law_ids.add(law["id"])

orphaned_refs = []
for tool_id, tool in tools.items():
    for reg_id in tool.get("applicable_regulations", []):
        if reg_id not in all_law_ids:
            orphaned_refs.append(f"{tool_id} → {reg_id}")

test("No orphaned law references in tools",
     len(orphaned_refs) == 0,
     f"Orphaned: {orphaned_refs[:3]}")


# ── Test 6: Patient-facing rights coverage ────────────────────────────────────
print("\n🔍 TEST 6: Patient-facing rights")

patient_facing_by_state = {}
for state_key, state_data in laws_data.get("states", {}).items():
    patient_rights = []
    for law in state_data.get("laws", []):
        for req in law.get("requirements", []):
            if req.get("patient_facing"):
                patient_rights.append(req["title"])
    patient_facing_by_state[state_key] = patient_rights

for state, rights in patient_facing_by_state.items():
    has_rights = len(rights) > 0
    if has_rights:
        test(f"Patient rights in {state}", True)
    else:
        warn(f"No patient-facing rights for {state}", "May need to add rights")


# ── Test 7: Schema validation ─────────────────────────────────────────────────
print("\n🔍 TEST 7: Schema validation")

try:
    sys.path.insert(0, str(Path(__file__).parent))
    from models.schemas import HospitalInput, PatientInput, HospitalType, HospitalSize

    # Test valid hospital input
    h = HospitalInput(
        state="texas",
        hospital_name="Test Regional Hospital",
        hospital_type=HospitalType.COMMUNITY_HOSPITAL,
        hospital_size=HospitalSize.MEDIUM,
        ai_tools=["epic_sepsis_model", "nuance_dax", "billing_coding_ai"],
        accepts_medicare_medicaid=True
    )
    test("HospitalInput schema validates", True)

    # Test valid patient input
    p = PatientInput(
        hospital_state="california",
        visit_type="inpatient",
        ai_tools_mentioned=["nuance_dax"]
    )
    test("PatientInput schema validates", True)

except Exception as e:
    test("Schema validation", False, str(e))


# ── Test 8: Demo scenario dry run ─────────────────────────────────────────────
print("\n🔍 TEST 8: Demo scenario preparation")

demo_state = "texas"
demo_tools = ["epic_sepsis_model", "nuance_dax", "optum_claims_ai"]

# Verify all demo tools exist
for tool in demo_tools:
    test(f"Demo tool exists: {tool}", tool in tools)

# Verify demo state has laws
demo_state_laws = laws_data.get("states", {}).get(demo_state, {}).get("laws", [])
test(f"Demo state {demo_state} has laws", len(demo_state_laws) > 0)

# Verify applicability matrix has demo state
test(f"Demo state {demo_state} in applicability matrix",
     demo_state in laws_data.get("law_applicability_matrix", {}))


# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "="*50)
print("VERIFICATION SUMMARY")
print("="*50)

if not errors:
    print(f"\n{PASS} ALL TESTS PASSED — Backend data layer is clean")
    print(f"   {len(warnings)} warnings (non-blocking)")
else:
    print(f"\n{FAIL} {len(errors)} ERRORS FOUND — Fix before proceeding")
    for err in errors:
        print(f"   • {err}")

if warnings:
    print(f"\n{WARN} WARNINGS:")
    for w in warnings:
        print(f"   • {w}")

print(f"""
📊 Data summary:
   • States with specific AI laws: {len(laws_data.get('states', {}))}
   • Federal laws: {len(laws_data.get('federal', {}).get('laws', []))}
   • Total law requirements: {total_reqs}
   • Tools in reference DB: {len(tools)}
   • Shadow AI indicators: {sum(1 for t in tools.values() if t.get('shadow_ai_indicator'))}
""")

sys.exit(0 if not errors else 1)
