"""
ClearPath LangGraph Pipeline

Architecture:
  input_processor (sequential)
       ↓
  ┌────┬────┬────────┐   ← PARALLEL FAN-OUT
  │    │    │        │
  Law  Gap  Shadow  Patient
  Map  Scan  AI    Transp.
  │    │    │        │
  └────┴────┴────────┘   ← FAN-IN (all complete)
       ↓
  safety_checker (sequential)
       ↓
  orchestrator (sequential)
       ↓
  Final output
"""

import uuid
import asyncio
import time
from typing import Any, Dict
from concurrent.futures import ThreadPoolExecutor

from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict

from agents.agents import (
    run_law_mapper,
    run_gap_scanner,
    run_shadow_ai_detector,
    run_patient_transparency,
    run_safety_checker,
)
from graph.orchestrator import run_orchestrator


# ── State definition ──────────────────────────────────────────────────────────

class ClearPathState(TypedDict, total=False):
    request_id: str
    request_type: str          # "hospital" | "patient" | "both"
    hospital_input: dict
    patient_input: dict

    # Agent outputs
    law_mapper_output: dict
    gap_scanner_output: dict
    shadow_ai_output: dict
    patient_transparency_output: dict
    safety_checker_output: dict

    # Final reports
    hospital_report: dict
    patient_report: dict

    # Meta
    error: str
    completed: bool
    start_time: float


# ── Node: Input Processor ─────────────────────────────────────────────────────

def input_processor_node(state: ClearPathState) -> ClearPathState:
    """Validate and enrich input before agents run."""
    return {
        **state,
        "request_id": state.get("request_id") or str(uuid.uuid4()),
        "start_time": state.get("start_time") or time.time(),
        "completed": False,
    }


# ── Node: Parallel agents (run all 4 simultaneously) ─────────────────────────

def parallel_agents_node(state: ClearPathState) -> ClearPathState:
    """
    Runs Law Mapper, Gap Scanner, Shadow AI Detector, and Patient Transparency
    in parallel using a thread pool (since Claude API calls are I/O bound).
    """
    request_type = state.get("request_type", "hospital")

    # Determine which agents to run
    agents_to_run = []

    if request_type in ("hospital", "both"):
        agents_to_run.extend([
            ("law_mapper", run_law_mapper),
            ("gap_scanner", run_gap_scanner),
            ("shadow_ai", run_shadow_ai_detector),
        ])

    # Patient transparency runs for both flow types
    agents_to_run.append(("patient", run_patient_transparency))

    # Execute in parallel
    results = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        future_to_agent = {
            executor.submit(agent_fn, state): name
            for name, agent_fn in agents_to_run
        }
        for future in future_to_agent:
            agent_name = future_to_agent[future]
            try:
                result = future.result(timeout=60)  # 60s timeout per agent
                results.update(result)
            except Exception as e:
                print(f"[WARNING] Agent {agent_name} failed: {e}")
                # Graceful degradation — don't fail the whole pipeline
                if agent_name == "law_mapper":
                    results["law_mapper_output"] = {
                        "error": str(e),
                        "applicable_laws": [],
                        "summary": "Law mapping failed — manual review required",
                        "agent": "law_mapper"
                    }
                elif agent_name == "gap_scanner":
                    results["gap_scanner_output"] = {
                        "error": str(e),
                        "compliance_gaps": [],
                        "overall_compliance_score": 0,
                        "critical_count": 0, "high_count": 0,
                        "medium_count": 0, "low_count": 0,
                        "immediate_actions_required": [],
                        "agent": "gap_scanner"
                    }
                elif agent_name == "shadow_ai":
                    results["shadow_ai_output"] = {
                        "error": str(e),
                        "shadow_ai_risks": [],
                        "shadow_ai_risk_level": "unknown",
                        "undeclared_tool_suspects": [],
                        "recommendation": "Shadow AI scan failed — manual review required",
                        "agent": "shadow_ai_detector"
                    }
                elif agent_name == "patient":
                    results["patient_transparency_output"] = {
                        "error": str(e),
                        "headline": "AI transparency report temporarily unavailable",
                        "what_ai_did": "We were unable to generate your AI summary. Please ask your care team directly.",
                        "why_it_was_used": "",
                        "did_ai_affect_decisions": False,
                        "your_rights": [],
                        "questions_to_ask_doctor": ["What AI tools were used in my care?"],
                        "reassurance_note": "Your care team can answer questions about technology used in your visit.",
                        "agent": "patient_transparency"
                    }

    return {**state, **results}


# ── Node: Safety Checker ──────────────────────────────────────────────────────

def safety_checker_node(state: ClearPathState) -> ClearPathState:
    try:
        result = run_safety_checker(state)
        return {**state, **result}
    except Exception as e:
        return {
            **state,
            "safety_checker_output": {
                "validation_passed": False,
                "issues_found": [{"issue_type": "system_error", "description": str(e), 
                                  "affected_agents": ["safety_checker"], "severity": "high"}],
                "corrections_made": [],
                "final_risk_level": "high",
                "safe_to_display": True,  # Default to showing — safety checker failure shouldn't block
                "validation_notes": f"Safety check failed with error: {e}",
                "agent": "safety_checker"
            }
        }


# ── Node: Orchestrator ────────────────────────────────────────────────────────

def orchestrator_node(state: ClearPathState) -> ClearPathState:
    try:
        result = run_orchestrator(state)
        return {**state, **result, "completed": True}
    except Exception as e:
        return {**state, "error": str(e), "completed": True}


# ── Build the graph ───────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    graph = StateGraph(ClearPathState)

    # Add nodes
    graph.add_node("input_processor", input_processor_node)
    graph.add_node("parallel_agents", parallel_agents_node)
    graph.add_node("safety_checker", safety_checker_node)
    graph.add_node("orchestrator", orchestrator_node)

    # Define edges (sequential flow with internal parallelism)
    graph.set_entry_point("input_processor")
    graph.add_edge("input_processor", "parallel_agents")
    graph.add_edge("parallel_agents", "safety_checker")
    graph.add_edge("safety_checker", "orchestrator")
    graph.add_edge("orchestrator", END)

    return graph.compile()


# ── Compiled graph (singleton) ────────────────────────────────────────────────
clearpath_graph = build_graph()


# ── Entry point ───────────────────────────────────────────────────────────────

def run_hospital_analysis(hospital_input: dict) -> dict:
    """Run the full ClearPath pipeline for a hospital admin."""
    initial_state: ClearPathState = {
        "request_id": str(uuid.uuid4()),
        "request_type": "hospital",
        "hospital_input": hospital_input,
        "start_time": time.time(),
    }
    result = clearpath_graph.invoke(initial_state)
    return result


def run_patient_analysis(patient_input: dict) -> dict:
    """Run the ClearPath pipeline for a patient transparency report."""
    initial_state: ClearPathState = {
        "request_id": str(uuid.uuid4()),
        "request_type": "patient",
        "patient_input": patient_input,
        "start_time": time.time(),
    }
    result = clearpath_graph.invoke(initial_state)
    return result


def run_combined_analysis(hospital_input: dict, patient_input: dict) -> dict:
    """Run the full pipeline for both hospital and patient views."""
    initial_state: ClearPathState = {
        "request_id": str(uuid.uuid4()),
        "request_type": "both",
        "hospital_input": hospital_input,
        "patient_input": patient_input,
        "start_time": time.time(),
    }
    result = clearpath_graph.invoke(initial_state)
    return result
