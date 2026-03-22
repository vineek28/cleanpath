"""
ClearPath RAG Retriever — TF-IDF based, fully local, no downloads needed.
Build index: python rag/ingest.py
"""
import json, pickle, re
from pathlib import Path
from typing import List, Dict, Any, Optional
from functools import lru_cache
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

RAG_DIR    = Path(__file__).parent
DATA_DIR   = RAG_DIR.parent / "data"
INDEX_PATH = RAG_DIR / "tfidf_index.pkl"

def build_index(docs, metadatas):
    vec = TfidfVectorizer(ngram_range=(1,2), max_features=20000, sublinear_tf=True, stop_words="english")
    matrix = vec.fit_transform(docs)
    return {"vectorizer": vec, "matrix": matrix, "docs": docs, "metadatas": metadatas, "kb_version": "1.0.0"}

def save_index(index):
    with open(INDEX_PATH, "wb") as f:
        pickle.dump(index, f)

@lru_cache(maxsize=1)
def _load_index():
    if not INDEX_PATH.exists():
        return None
    try:
        with open(INDEX_PATH, "rb") as f:
            return pickle.load(f)
    except Exception:
        return None

@lru_cache(maxsize=1)
def _load_json_data():
    with open(DATA_DIR / "state_laws.json") as f:
        laws = json.load(f)
    with open(DATA_DIR / "hospital_tools.json") as f:
        tools = json.load(f)
    return {"laws": laws, "tools": tools}

def _keyword_search(query, state=None, n=8):
    data = _load_json_data()
    words = set(w for w in re.sub(r'[^\w\s]','',query.lower()).split() if len(w)>3)
    results = []
    state_key = (state or "").lower().replace(" ","_")
    for s_key, s_data in data["laws"]["states"].items():
        if state_key and s_key != state_key: continue
        for law in s_data.get("laws", []):
            for req in law.get("requirements", []):
                text = f"{law['full_name']} ({law['id']}) — {req['title']}: {req['description']}"
                score = sum(1 for w in words if w in text.lower())
                if score > 0:
                    results.append({"text": text, "law_id": law["id"], "state": s_key,
                        "source": "json_keyword", "doc_type": "requirement",
                        "relevance_score": round(score/max(len(words),1), 3), "kb_version": "1.0.0"})
    for law in data["laws"]["federal"]["laws"]:
        for req in law.get("requirements", []):
            text = f"{law['full_name']} ({law['id']}) — {req['title']}: {req['description']}"
            score = sum(1 for w in words if w in text.lower())
            results.append({"text": text, "law_id": law["id"], "state": "federal",
                "source": "json_keyword", "doc_type": "requirement",
                "relevance_score": max(round(score/max(len(words),1),3), 0.1), "kb_version": "1.0.0"})
    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return results[:n]

def _tfidf_search(query, state=None, n=8, doc_types=None):
    idx = _load_index()
    if idx is None:
        return _keyword_search(query, state, n)
    try:
        vec = idx["vectorizer"].transform([query])
        scores = cosine_similarity(vec, idx["matrix"]).flatten()
        top = np.argsort(scores)[::-1]
        results = []
        state_key = (state or "").lower().replace(" ","_")
        for i in top:
            if len(results) >= n or scores[i] < 0.01: break
            meta = idx["metadatas"][i]
            if state_key and meta.get("state","") not in (state_key,"federal",""): continue
            if doc_types and meta.get("doc_type") not in doc_types: continue
            results.append({"text": idx["docs"][i], "law_id": meta.get("law_id",""),
                "state": meta.get("state",""), "source": "tfidf_index",
                "doc_type": meta.get("doc_type",""),
                "relevance_score": round(float(scores[i]),3), "kb_version": "1.0.0"})
        return results
    except Exception:
        return _keyword_search(query, state, n)

def query_for_law_mapper(state: str, tools: List[str]) -> str:
    queries = [
        f"healthcare AI laws requirements {state}",
        f"AI disclosure transparency patient rights {state}",
        f"HIPAA artificial intelligence protected health information",
        f"CMS Medicare Medicaid AI clinical decision support",
        f"HHS AI safety program hospital governance",
    ] + [f"{t} compliance disclosure governance" for t in tools]

    seen, all_results = set(), []
    for q in queries:
        for r in _tfidf_search(q, state=state, n=5):
            key = r["text"][:80]
            if key not in seen:
                seen.add(key)
                all_results.append(r)

    all_results.sort(key=lambda x: x["relevance_score"], reverse=True)
    idx = _load_index()
    source = f"tfidf_index ({len(idx['docs'])} chunks)" if idx else "json_keyword_fallback"
    parts = [f"[RAG SOURCE: {source} | KB VERSION: 1.0.0]\n"]
    for r in all_results[:14]:
        parts.append(f"[{r['doc_type']}|{r['state']}|score:{r['relevance_score']}]\n{r['text']}")
    return "\n\n---\n\n".join(parts)

def query_for_gap_scanner(state: str, tools: List[str], applicable_law_ids: List[str]) -> str:
    queries = [f"{lid} requirements compliance documentation" for lid in applicable_law_ids]
    queries += [f"{t} HIPAA BAA disclosure audit trail" for t in tools[:4]]
    seen, all_results = set(), []
    for q in queries:
        for r in _tfidf_search(q, state=state, n=4, doc_types=["requirement","tool_profile"]):
            key = r["text"][:80]
            if key not in seen:
                seen.add(key)
                all_results.append(r)
    all_results.sort(key=lambda x: x["relevance_score"], reverse=True)
    parts = ["[RAG SOURCE: gap_scanner_context | KB VERSION: 1.0.0]\n"]
    for r in all_results[:12]:
        parts.append(f"[{r.get('doc_type','doc')}|score:{r['relevance_score']}]\n{r['text']}")
    return "\n\n---\n\n".join(parts)

def get_rag_status() -> Dict[str, Any]:
    idx = _load_index()
    if idx:
        return {"status": "ready", "backend": "tfidf_index",
                "chunk_count": len(idx["docs"]), "kb_version": "1.0.0"}
    return {"status": "fallback", "backend": "json_keyword_fallback",
            "chunk_count": 0, "kb_version": "1.0.0",
            "message": "Run python rag/ingest.py to build index"}
