"""CORDON control plane — FastAPI app.

Phase 1: SSE stream over the event bus + a /debug/run route that drives the full
attack-to-containment sequence through the real deterministic components, so the
event flow can be watched live. Daytona/1Password are still stubbed (Phase 2);
the demo-mode replay source is wired in Phase 5.
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from demo.replay import replay, timeline as demo_timeline

from control_plane.broker import Broker
from control_plane.config import DEMO_MODE
from control_plane.events import EventBus
from control_plane.graph import ContactGraph
from control_plane.integrations import daytona as dyt_integration
from control_plane.integrations import onepassword as op_integration
from control_plane.proxy import PRODUCTION_SECRET_REF, ROSTER, ToolProxy  # noqa: F401
from control_plane.quarantine import QuarantineEngine
from control_plane.recorder import FlightRecorder
from control_plane.taint import TaintStore
from swarm.attack import POISONED_EMAIL


@dataclass
class System:
    bus: EventBus
    taint: TaintStore
    graph: ContactGraph
    recorder: FlightRecorder
    broker: Broker
    quarantine: QuarantineEngine


def _make_broker(taint: TaintStore, bus: EventBus, recorder: FlightRecorder) -> Broker:
    """Use the real 1Password resolver when a Service Account token is configured;
    otherwise fall back to the deterministic stub (keeps offline unit tests working)."""
    if op_integration.is_configured():
        return Broker(taint=taint, bus=bus, recorder=recorder, resolver=op_integration.resolve)
    return Broker(taint=taint, bus=bus, recorder=recorder)


def _make_quarantine(taint: TaintStore, graph: ContactGraph, bus: EventBus,
                     broker: Broker, recorder: FlightRecorder) -> QuarantineEngine:
    """Use the real Daytona freezer when an API key is configured; otherwise the stub.
    The real freezer only acts on sandboxes Daytona actually created, so the headless
    spine (placeholder sandbox ids) is harmlessly skipped."""
    if dyt_integration.is_configured():
        return QuarantineEngine(taint=taint, graph=graph, bus=bus, broker=broker,
                                recorder=recorder, freezer=dyt_integration.freeze)
    return QuarantineEngine(taint=taint, graph=graph, bus=bus, broker=broker, recorder=recorder)


def build_system() -> System:
    bus = EventBus()
    taint = TaintStore()
    graph = ContactGraph()
    recorder = FlightRecorder(bus=bus)
    broker = _make_broker(taint, bus, recorder)
    quarantine = _make_quarantine(taint, graph, bus, broker, recorder)
    return System(bus, taint, graph, recorder, broker, quarantine)


def reset_system(s: System) -> System:
    """Fresh deterministic state on the SAME bus (keeps SSE subscribers connected)."""
    s.bus.clear()
    s.taint = TaintStore()
    s.graph = ContactGraph()
    s.recorder = FlightRecorder(bus=s.bus)
    s.broker = _make_broker(s.taint, s.bus, s.recorder)
    s.quarantine = _make_quarantine(s.taint, s.graph, s.bus, s.broker, s.recorder)
    return s


def run_canonical(s: System) -> dict:
    """The full attack-to-containment story, headless, driven through the Tool Proxy.
    Mirrors demo/scenario.json's cordon_on path and pins the ordered event contract
    that the live swarm reproduces."""
    reset_system(s)
    proxy = ToolProxy(s)

    proxy.start_scenario("on")
    proxy.register_swarm()
    proxy.handoff("orchestrator", "inbox", reason="delegation: triage the inbox")
    proxy.tool_call("inbox", "read_email", "untrusted",
                    summary="Reads incoming email, including an attacker-authored message",
                    content=POISONED_EMAIL)
    proxy.handoff("inbox", "research")
    proxy.handoff("research", "coder")
    decision = proxy.request_credential("coder", PRODUCTION_SECRET_REF, sensitive=True)
    proxy.complete("on")

    return {
        "decision": decision["decision"],
        "sensitive_secret_resolved_for_tainted": any(
            c["sensitive"] and s.taint.is_tainted(c["agent_id"]) for c in s.broker.resolve_calls),
        "patient_zero": s.graph.trace_origin("coder"),
        "quarantined": decision.get("quarantine_order", []),
        "recorder_valid": s.recorder.verify(),
        "events_emitted": s.bus.seq,
    }


app = FastAPI(title="CORDON Control Plane")
# the Next.js dashboard runs on a different port; allow it to read the SSE stream
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)
system = build_system()


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "cordon-control-plane",
        "demo_mode": DEMO_MODE,
        "onepassword": "live" if op_integration.is_configured() else "stub",
        "daytona": "live" if dyt_integration.is_configured() else "stub",
    }


@app.get("/stream")
async def stream(request: Request):
    q = system.bus.subscribe()

    async def gen():
        try:
            for env in list(system.bus.history):  # catch up a late-connecting dashboard
                yield {"data": json.dumps(env)}
            while True:
                if await request.is_disconnected():
                    break
                env = await q.get()
                yield {"data": json.dumps(env)}
        finally:
            system.bus.unsubscribe(q)

    return EventSourceResponse(gen())


@app.api_route("/debug/run", methods=["GET", "POST"])
def debug_run() -> dict:
    """Drive the deterministic spine through the Tool Proxy (Phase 1)."""
    return run_canonical(system)


@app.api_route("/live/run", methods=["GET", "POST"])
async def live_run() -> dict:
    """Drive the dashboard from the REAL OpenAI agent swarm (Phase 3). The agents
    actually run; the deterministic taint/broker/cascade guarantees hold regardless
    of model behavior."""
    from swarm.run import run_live  # lazy import (pulls in the Agents SDK)

    reset_system(system)
    return await run_live(system)


@app.api_route("/live/cleanup", methods=["GET", "POST"])
async def live_cleanup() -> dict:
    """Delete any real Daytona sandboxes created by live runs."""
    n = len(dyt_integration.manager()._sandboxes)
    await asyncio.to_thread(dyt_integration.manager().cleanup)
    return {"deleted": n}


_replay_task: asyncio.Task | None = None


@app.get("/demo/timeline")
def demo_timeline_route(scenario: str = "deploy", mode: str = "on") -> dict:
    """Return the full scripted event list so the dashboard can play it locally
    (client-side play / pause / step / scrub / speed)."""
    return {"scenario": scenario, "mode": mode, "events": demo_timeline(scenario, mode)}


@app.api_route("/demo/play", methods=["GET", "POST"])
async def demo_play(mode: str = "on", speed: float = 1.0, scenario: str = "deploy") -> dict:
    """Drive the dashboard from the scripted timeline (demo mode). Non-blocking:
    the replay streams over the SSE channel over time. Any in-flight replay is
    cancelled first so rapid toggle clicks can't interleave two timelines."""
    global _replay_task
    if _replay_task is not None and not _replay_task.done():
        _replay_task.cancel()
    _replay_task = asyncio.create_task(replay(system.bus, mode=mode, scenario=scenario, speed=speed))
    return {"playing": mode, "scenario": scenario, "speed": speed}


@app.api_route("/daytona/netblock-proof", methods=["GET", "POST"])
async def daytona_netblock_proof() -> dict:
    """Live proof of real Daytona network isolation (create → curl OK → block → curl
    fails → destroy). Runs the sync SDK in a thread so the event loop stays free."""
    if not dyt_integration.is_configured():
        return {"configured": False}
    proof = await asyncio.to_thread(dyt_integration.manager().netblock_proof)
    return {"configured": True, **proof}


@app.api_route("/eval/run", methods=["GET", "POST"])
def eval_run() -> dict:
    """Run the eval benchmark: attack + benign variants through the real engine,
    compared against a naive keyword detector. Returns metrics + per-case rows."""
    from control_plane.benchmark import run_benchmark

    return run_benchmark()
