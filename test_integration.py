"""
ClearPath Integration Test
Run this to verify frontend ↔ backend ↔ database are all working.

Usage:
    python test_integration.py
"""
import httpx
import json
import sys

BASE = "http://localhost:8000"
PASS = "✓"
FAIL = "✗"

def test(name, fn):
    try:
        result = fn()
        print(f"  {PASS} {name}")
        return result
    except Exception as e:
        print(f"  {FAIL} {name}: {e}")
        return None

print("\n🔍 ClearPath Integration Test\n" + "="*40)

# 1. Health check
print("\n[1] Backend Health")
r = test("API responding", lambda: httpx.get(f"{BASE}/api/health", timeout=5).raise_for_status())
r = test("Deep health check", lambda: httpx.get(f"{BASE}/api/health/deep", timeout=10).raise_for_status())

# 2. NPI lookup — real NPPES API
print("\n[2] NPI Registry (Live CMS API)")
npi_result = test("NPI lookup — Mayo Clinic", lambda: (
    lambda r: r if r.get("found") and r.get("active") else (_ for _ in ()).throw(Exception(f"Not found: {r}"))
)(httpx.get(f"{BASE}/api/npi/1841266194", timeout=10).json()))

if npi_result:
    print(f"      Hospital: {npi_result.get('hospital')}")
    print(f"      City: {npi_result.get('city')}")
    print(f"      Source: {npi_result.get('source')}")

# 3. Shadow AI standalone
print("\n[3] Shadow AI Engine")
shadow = test("Shadow AI heuristics", lambda: httpx.post(f"{BASE}/api/analyze/shadow-ai", json={
    "state": "texas", "hospital_type": "academic_medical_center",
    "hospital_size": "large", "ai_tools": ["billing_coding_ai"],
    "accepts_medicare_medicaid": True
}, timeout=15).json())
if shadow:
    risks = shadow.get("shadow_ai_risks", [])
    print(f"      Risks found: {len(risks)}")
    print(f"      Baseline risk: {shadow.get('baseline_risk_percentage')}%")

# 4. Full hospital analysis — THIS IS THE MAIN TEST
print("\n[4] Full Hospital Analysis (5-agent pipeline)")
print("      ⏳ Running agents... this takes ~60s")
analysis = test("Complete hospital scan", lambda: (
    lambda r: r if r.get("success") else (_ for _ in ()).throw(Exception(f"Failed: {r}"))
)(httpx.post(f"{BASE}/api/analyze/hospital", json={
    "state": "texas",
    "hospital_name": "Mayo Clinic Hospital — Rochester",
    "hospital_type": "academic_medical_center",
    "hospital_size": "large",
    "ai_tools": ["epic_sepsis_model", "billing_coding_ai", "chatgpt_clinical"],
    "accepts_medicare_medicaid": True
}, timeout=180).json()))

if analysis:
    report = analysis.get("hospital_report", {})
    print(f"      Audit ID: {analysis.get('audit_id')}")
    print(f"      Score: {report.get('overall_compliance_score')}/100")
    print(f"      Risk: {report.get('overall_risk_level')}")
    print(f"      Laws: {len(report.get('applicable_laws', []))}")
    print(f"      Gaps: {len(report.get('compliance_gaps', []))}")
    print(f"      Shadow AI: {len(report.get('shadow_ai_risks', []))}")
    print(f"      Time: {analysis.get('processing_time_ms')}ms")

# 5. Audit trail
print("\n[5] Audit Trail (SQLite)")
stats = test("Platform stats", lambda: httpx.get(f"{BASE}/api/stats", timeout=5).json())
if stats:
    print(f"      Total scans logged: {stats.get('total_scans')}")
    print(f"      Avg compliance score: {stats.get('avg_compliance_score')}")

history = test("Scan history", lambda: httpx.get(f"{BASE}/api/audit/history?limit=5", timeout=5).json())
if history:
    print(f"      Recent scans in DB: {len(history.get('scans', []))}")

print("\n" + "="*40)
print("Integration test complete.\n")
