"""Taint is monotonic, isolated, and propagates only over taint-carrying handoffs."""
from __future__ import annotations

from control_plane.graph import ContactGraph
from control_plane.models import AgentStatus
from control_plane.taint import TaintStore


def test_taint_is_monotonic_and_isolated():
    t = TaintStore()
    for a in ("a", "b", "c"):
        t.register(a)
    t.mark_tainted("a", "read_email")
    assert t.is_tainted("a")
    assert not t.is_tainted("b")

    # quarantine must not be downgraded by a later mark_tainted
    t.quarantine("a")
    t.mark_tainted("a", "again")
    assert t.status("a") == AgentStatus.QUARANTINED


def test_taint_propagates_over_handoff():
    t = TaintStore()
    g = ContactGraph()
    for a in ("a", "b", "c"):
        t.register(a)
        g.add_agent(a)

    t.mark_tainted("a", "src")
    g.add_contact("a", "b", carried_taint=True)   # proxy carries taint across the edge
    t.mark_tainted("b", "a")

    assert t.is_tainted("b")
    assert not t.is_tainted("c")          # an untouched agent stays healthy
