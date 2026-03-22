# ClearPath — Healthcare AI Governance Hub

> "The US government passed 250+ healthcare AI laws in 2026. Nobody built the system to run them. We did."

**HackASU 2026 | Track 4: Governance & Collaboration**

---

## What It Does

ClearPath is a multi-agent AI platform that:

1. Takes a hospital's state + list of AI tools in use
2. Maps which 2026 state/federal laws apply to them
3. Flags compliance gaps with severity scoring and confidence scores
4. Auto-generates an audit-ready compliance report for hospital administrators
5. Simultaneously generates a plain-English patient transparency report — "here's what AI was used in your care"

**Two stakeholders. One platform. Same data. Shared accountability.**

---

## Architecture

```
User Input (hospital state + tools OR patient record)
              ↓
    input_processor (sequential — validates input)
              ↓
    ┌─────────────────────────────────────┐
    │         PARALLEL AGENTS             │  ← Fan-out
    ├──────────┬──────────┬───────────────┤
    │          │          │               │
    Law        Gap        Shadow          Patient
    Mapper     Scanner    AI              Transparency
    Agent      Agent      Detector        Agent
    │          │          │               │
    Which      What's     Finds           Plain-English
    laws       missing    unauthorized    patient
    apply      from       tools           summary
               each law
    └──────────┴──────────┴───────────────┘  ← Fan-in
              ↓
    safety_checker (sequential — validates all outputs)
    Checks: contradictions, overconfidence, false accusations
              ↓
    orchestrator (assembles final output)
              ↓
    ┌─────────────────────┬──────────────────────┐
    │  HOSPITAL VIEW      │  PATIENT VIEW        │
    │  Compliance report  │  Plain English report│
    │  Audit trail        │  AI used in my care  │
    │  Action checklist   │  My rights           │
    └─────────────────────┴──────────────────────┘
```

**Pattern**: Fan-out / fan-in — used in production at Google, Netflix, AWS.

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI backbone | Claude API (`claude-sonnet-4-20250514`) |
| Agent framework | LangGraph (fan-out/fan-in parallel execution) |
| Backend | FastAPI (Python) |
| Data layer | Structured JSON (state laws + tool profiles) |
| Frontend | React + Tailwind |
| Deployment | Vercel (frontend) + Railway/Render (backend) |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-repo/clearpath
cd clearpath
pip install -r requirements.txt
```

### 2. Set environment variables

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY
```

### 3. Verify data integrity

```bash
python verify_data.py
# All 35 tests should pass before running the API
```

### 4. Run the server

```bash
uvicorn main:app --reload --port 8000
```

### 5. API docs

Open `http://localhost:8000/docs` — interactive Swagger UI for all endpoints.

---

## API Endpoints

### `POST /api/analyze/hospital`
Full compliance analysis for a hospital administrator.

```json
{
  "state": "texas",
  "hospital_name": "Memorial Regional Medical Center",
  "hospital_type": "community_hospital",
  "hospital_size": "medium",
  "ai_tools": ["epic_sepsis_model", "nuance_dax", "billing_coding_ai"],
  "accepts_medicare_medicaid": true
}
```

### `POST /api/analyze/patient`
Patient transparency report.

```json
{
  "hospital_state": "california",
  "visit_type": "inpatient",
  "ai_tools_mentioned": ["nuance_dax"],
  "visit_summary": "I had a 3-day hospital stay for pneumonia"
}
```

### `POST /api/analyze/combined`
**Primary demo endpoint.** Runs both hospital and patient reports simultaneously.

### `GET /api/laws/{state}`
Returns all laws applicable to a given state.

### `GET /api/tools`
Returns the full AI tool reference database with risk profiles.

---

## Data Coverage

### States with Specific AI Laws
| State | Laws |
|---|---|
| Texas | TRAIGA (2026) |
| California | AB 489, SB 942, AB 2013 (2026) |
| Colorado | Colorado AI Act (2026) |
| Illinois | Illinois Artificial Intelligence Act |
| New York (City) | Local Law 144 |
| Florida | HB 1459 |

### Federal Laws (all states)
- HIPAA AI Addendum (HHS Guidance)
- CMS AI Strategy (Medicare/Medicaid requirements)
- HHS AI Safety Program

### AI Tools in Reference Database
11 tools including: Epic Sepsis Model, Nuance DAX, Viz.ai, Optum Claims AI, ChatGPT (shadow AI), Azure OpenAI, Radiology AI, Billing Coding AI, and more.

---

## How Claude Is Used

Every agent in the pipeline makes a direct call to the Claude API:

1. **Law Mapper** — `claude-sonnet-4-20250514` maps state + tools → applicable laws
2. **Gap Scanner** — identifies compliance gaps with severity and confidence scoring
3. **Shadow AI Detector** — flags likely unauthorized AI usage based on hospital profile
4. **Patient Transparency Agent** — generates plain-English patient rights reports
5. **Safety Checker** — validates all outputs for contradictions and overconfidence
6. **Orchestrator** — assembles final hospital and patient reports

All API calls are visible in `agents/agents.py` and `graph/orchestrator.py`.

---

## Ethical Design

| Concern | Our Approach |
|---|---|
| False accusations of hospitals | Every finding has a confidence score. Below 0.7, flagged as "possible, not confirmed." |
| Patient data privacy | No patient data stored. Session-only processing. HIPAA-aware throughout. |
| Replacing legal counsel | Every output includes explicit disclaimer: not legal advice. |
| Hallucination risk | Safety Checker agent validates all outputs before display. |
| Bias in findings | Confidence scoring + evidence requirement before any claim. |

---

## Disclaimer

ClearPath is a governance tool built to assist compliance professionals. It does **not** constitute legal advice. Consult a qualified healthcare compliance attorney before making compliance decisions based on this system's output.

---

## Team

Built at HackASU 2026 | March 20-22 | Track 4: Governance & Collaboration
