"""Phase 2b integration test — REAL Daytona freeze via the quarantine engine.

Creates and destroys a real sandbox, so it's opt-in: run with
    CORDON_RUN_DAYTONA_IT=1 .venv/bin/python -m pytest tests/test_integration_daytona.py
The normal `pytest` run skips it (fast + no Daytona credit spent).
"""
from __future__ import annotations

import os

import pytest

from control_plane.broker import Broker
from control_plane.events import EventBus
from control_plane.graph import ContactGraph
from control_plane.integrations import daytona as dyt
from control_plane.quarantine import QuarantineEngine
from control_plane.taint import TaintStore

pytestmark = pytest.mark.skipif(
    not (dyt.is_configured() and os.getenv("CORDON_RUN_DAYTONA_IT") == "1"),
    reason="set CORDON_RUN_DAYTONA_IT=1 (and DAYTONA_API_KEY) to run the live Daytona test",
)


def test_quarantine_freezes_a_real_sandbox():
    mgr = dyt.manager()
    bus, taint, graph = EventBus(), TaintStore(), ContactGraph()
    quarantine = QuarantineEngine(taint, graph, bus, Broker(taint, bus), freezer=dyt.freeze)

    sandbox_id = mgr.create_for("coder")
    taint.register("coder", sandbox_id=sandbox_id)
    graph.add_agent("coder")
    taint.mark_tainted("coder", "read_email")

    try:
        order = quarantine.quarantine("coder")
        assert order == ["coder"]
        state = mgr.state(sandbox_id).upper()
        assert "STOP" in state, f"expected the sandbox to be stopped, got {state!r}"
    finally:
        mgr.cleanup()
