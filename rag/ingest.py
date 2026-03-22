"""
ClearPath RAG Ingestion Pipeline
Builds a local TF-IDF index from law JSON + government HTML sources.

Usage:
    python rag/ingest.py              # full ingest
    python rag/ingest.py --json-only  # skip live downloads
    python rag/ingest.py --reset      # wipe and rebuild
"""
import json, os, re, sys, time, argparse, hashlib, requests
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

DATA_DIR  = Path(__file__).parent.parent / "data"
RAG_DIR   = Path(__file__).parent
CACHE_DIR = RAG_DIR / "doc_cache"
CACHE_DIR.mkdir(exist_ok=True)

from rag.retriever import build_index, save_index, INDEX_PATH

def chunk_text(text, chunk_size=400, overlap=80):
    chars = chunk_size * 4
    ov    = overlap * 4
    text  = re.sub(r'\s+', ' ', text).strip()
    chunks, start = [], 0
    while start < len(text):
        c = text[start:start+chars].strip()
        if c: chunks.append(c)
        start += chars - ov
    return chunks

def make_id(source, idx):
    return hashlib.md5(f"{source}:{idx}".encode()).hexdigest()[:12]

# ── Source 1: JSON knowledge base ─────────────────────────────────────────────
def collect_json_docs():
    print("📚 Reading JSON knowledge base...")
    with open(DATA_DIR / "state_laws.json") as f: laws = json.load(f)
    with open(DATA_DIR / "hospital_tools.json") as f: tools = json.load(f)
    docs, metas = [], []

    # State laws
    for s_key, s_data in laws["states"].items():
        for law in s_data.get("laws", []):
            overview = (f"LAW: {law['full_name']} ({law['id']})\n"
                        f"JURISDICTION: {s_data.get('display_name', s_key)} (State)\n"
                        f"EFFECTIVE: {law['effective_date']} | STATUS: {law['status']}\n"
                        f"APPLIES TO: {', '.join(law.get('applies_to',[]))}\n"
                        f"PENALTY: {law.get('penalties',{}).get('description','Varies')}\n"
                        f"NOTES: {law.get('notes','')}")
            docs.append(overview)
            metas.append({"law_id": law["id"], "state": s_key,
                          "jurisdiction": "state", "doc_type": "law_overview",
                          "source": "json_knowledge_base", "kb_version": "1.0.0"})
            for req in law.get("requirements", []):
                req_text = (f"LAW: {law['full_name']} ({law['id']}) — {s_data.get('display_name',s_key)}\n"
                            f"REQUIREMENT: {req['title']} [{req['id']}]\n"
                            f"CATEGORY: {req['category']} | SEVERITY: {req['severity']}\n"
                            f"PATIENT FACING: {req.get('patient_facing',False)}\n"
                            f"DOCUMENTATION REQUIRED: {req.get('documentation_required',False)}\n"
                            f"DESCRIPTION: {req['description']}")
                docs.append(req_text)
                metas.append({"law_id": law["id"], "requirement_id": req["id"],
                              "state": s_key, "jurisdiction": "state",
                              "severity": req["severity"], "doc_type": "requirement",
                              "source": "json_knowledge_base", "kb_version": "1.0.0"})

    # Federal laws
    for law in laws["federal"]["laws"]:
        overview = (f"LAW: {law['full_name']} ({law['id']})\n"
                    f"JURISDICTION: Federal (United States)\n"
                    f"EFFECTIVE: {law['effective_date']}\n"
                    f"APPLIES TO: {', '.join(law.get('applies_to',[]))}\n"
                    f"NOTES: {law.get('notes','')}")
        docs.append(overview)
        metas.append({"law_id": law["id"], "state": "federal",
                      "doc_type": "law_overview", "source": "json_knowledge_base",
                      "kb_version": "1.0.0"})
        for req in law.get("requirements", []):
            req_text = (f"LAW: {law['full_name']} ({law['id']}) — Federal\n"
                        f"REQUIREMENT: {req['title']} [{req['id']}]\n"
                        f"SEVERITY: {req['severity']}\n"
                        f"DESCRIPTION: {req['description']}")
            docs.append(req_text)
            metas.append({"law_id": law["id"], "requirement_id": req["id"],
                          "state": "federal", "severity": req["severity"],
                          "doc_type": "requirement", "source": "json_knowledge_base",
                          "kb_version": "1.0.0"})

    # Tool profiles
    for tool_id, tool in tools["tools"].items():
        tool_text = (f"AI TOOL: {tool['display_name']} (ID: {tool_id})\n"
                     f"VENDOR: {tool.get('vendor','')}\n"
                     f"CATEGORY: {tool.get('category','')} | RISK: {tool.get('risk_level','')}\n"
                     f"REQUIRES BAA: {tool.get('requires_baa',False)} | PHI ACCESS: {tool.get('phi_access',False)}\n"
                     f"AFFECTS CLINICAL: {tool.get('affects_clinical_decisions',False)} | BILLING: {tool.get('affects_billing',False)}\n"
                     f"SHADOW AI RISK: {tool.get('shadow_ai_risk','low')} | COMMONLY UNDISCLOSED: {tool.get('commonly_undisclosed',False)}\n"
                     f"KNOWN ISSUES: {'; '.join(tool.get('known_issues',[]))}\n"
                     f"REGULATIONS: {', '.join(tool.get('applicable_regulations',[]))}\n"
                     f"GOVERNANCE: {'; '.join(tool.get('governance_requirements',[]))}")
        docs.append(tool_text)
        metas.append({"tool_id": tool_id, "risk_level": tool.get("risk_level",""),
                      "doc_type": "tool_profile", "source": "json_knowledge_base",
                      "kb_version": "1.0.0"})

    print(f"  ✅ {len(docs)} documents from JSON")
    return docs, metas

# ── Source 2: Live government sources ─────────────────────────────────────────
SOURCES = [
    {"id":"hhs_hipaa_ai","law_id":"HIPAA_AI","state":"federal",
     "url":"https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/artificial-intelligence/index.html"},
    {"id":"cms_ai_strategy","law_id":"CMS_AI_STRATEGY","state":"federal",
     "url":"https://www.cms.gov/priorities/innovation/key-concepts/artificial-intelligence"},
    {"id":"hhs_ai_safety","law_id":"HHS_AI_SAFETY","state":"federal",
     "url":"https://www.hhs.gov/about/news/2024/12/17/hhs-launches-artificial-intelligence-safety-program.html"},
]

def fetch_html(url):
    try:
        r = requests.get(url, timeout=15,
            headers={"User-Agent":"Mozilla/5.0 (compatible; ClearPath/1.0)"})
        r.raise_for_status()
        text = re.sub(r'<script[^>]*>.*?</script>', '', r.text, flags=re.DOTALL)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = text.replace('&amp;','&').replace('&nbsp;',' ').replace('&#39;',"'")
        return re.sub(r'\s+', ' ', text).strip()
    except Exception as e:
        return ""

def collect_live_docs():
    print("\n🌐 Fetching live government sources...")
    docs, metas = [], []
    for src in SOURCES:
        cache = CACHE_DIR / f"{src['id']}.txt"
        if cache.exists():
            text = cache.read_text(encoding="utf-8", errors="ignore")
            print(f"  📄 Cached: {src['id']} ({len(text)} chars)")
        else:
            print(f"  → Fetching {src['url']}")
            text = fetch_html(src["url"])
            if len(text) > 500:
                cache.write_text(text, encoding="utf-8")
                print(f"  ✅ {len(text)} chars")
            else:
                print(f"  ⚠️  Too short — skipping")
                continue
            time.sleep(0.5)
        chunks = chunk_text(text)
        for i, c in enumerate(chunks):
            docs.append(c)
            metas.append({"law_id": src["law_id"], "state": src["state"],
                          "doc_type": "statutory_text", "source": "government_website",
                          "url": src["url"], "kb_version": "1.0.0"})
        print(f"    📦 {len(chunks)} chunks")
    return docs, metas

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-only", action="store_true")
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    if args.reset and INDEX_PATH.exists():
        INDEX_PATH.unlink()
        print("↩  Index reset")

    print("=" * 50)
    print("  ClearPath RAG Ingestion")
    print("=" * 50)
    start = time.time()

    all_docs, all_metas = collect_json_docs()

    if not args.json_only:
        live_docs, live_metas = collect_live_docs()
        all_docs  += live_docs
        all_metas += live_metas

    print(f"\n🔨 Building TF-IDF index over {len(all_docs)} documents...")
    index = build_index(all_docs, all_metas)
    save_index(index)

    print(f"\n{'='*50}")
    print(f"  ✅ Index built: {len(all_docs)} chunks")
    print(f"  ⏱  Time: {round(time.time()-start, 2)}s")
    print(f"  📁 Saved: {INDEX_PATH}")

if __name__ == "__main__":
    main()
