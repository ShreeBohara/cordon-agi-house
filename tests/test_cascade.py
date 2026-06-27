"""Cascade quarantine: exactly the exposed sub-graph, in infection order, once each."""
from __future__ import annotations

from control_plane.broker import Broker
from control_plane.events import EventBus
from control_plane.graph import ContactGraph
from control_plane.quarantine import QuarantineEngine
from control_plane.taint import TaintStore


def test_cascade_quarantines_exposed_subgraph_in_order():
    bus, taint, graph = EventBus(), TaintStore(), ContactGraph()
    broker = Broker(taint, bus)
    freeze_log: list[tuple[str, str]] = []
    q = QuarantineEngine(taint, graph, bus, broker, freezer=lambda a, s: freeze_log.append((a, s)))

    for a in ("orchestrator", "inbox", "research", "coder", "deployer"):
        taint.register(a, sandbox_id=f"sbx-{a}")
        graph.add_agent(a)
    graph.add_contact("orchestrator", "inbox", carried_taint=False)   # delegation, no taint
    graph.add_contact("inbox", "research", carried_taint=True)
    graph.add_contact("research", "coder", carried_taint=True)
    for a in ("inbox", "research", "coder"):
        taint.mark_tainted(a, "x")

    origin = graph.trace_origin("coder")
    assert origin == "inbox"

    order = q.quarantine(origin)
    assert order == ["inbox", "research", "coder"]
    assert q.revoke_calls == ["inbox", "research", "coder"]
    assert [a for a, _ in freeze_log] == ["inbox", "research", "coder"]   # once each
    assert freeze_log[0] == ("inbox", "sbx-inbox")                        # correct sandbox id

    assert all(taint.is_quarantined(a) for a in ("inbox", "research", "coder"))
    assert not taint.is_quarantined("orchestrator")     # healthy delegator untouched
    assert not taint.is_quarantined("deployer")         # healthy, never in the path


def test_leaf_cascade_quarantines_only_itself():
    bus, taint, graph = EventBus(), TaintStore(), ContactGraph()
    q = QuarantineEngine(taint, graph, bus, Broker(taint, bus))
    for a in ("a", "b"):
        taint.register(a)
        graph.add_agent(a)
    taint.mark_tainted("b", "x")
    assert q.quarantine("b") == ["b"]
