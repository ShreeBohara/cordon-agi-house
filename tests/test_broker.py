"""The broker gate: taint denies sensitive secrets without ever resolving them."""
from __future__ import annotations

from control_plane.broker import Broker
from control_plane.events import EventBus
from control_plane.taint import TaintStore


def _make():
    bus = EventBus()
    taint = TaintStore()
    return bus, taint, Broker(taint, bus)


def test_healthy_sensitive_is_allowed_and_resolved():
    _, t, b = _make()
    t.register("h")
    d = b.request("h", "op://v/i/f", sensitive=True)
    assert d["decision"] == "issued"
    assert "op://v/i/f" in b.resolved_refs
    assert d["value"].startswith("STUB_SECRET::")


def test_tainted_sensitive_is_denied_without_resolving():
    _, t, b = _make()
    t.register("x")
    t.mark_tainted("x", "read_email")
    d = b.request("x", "op://prod/key/cred", sensitive=True)
    assert d["decision"] == "denied"
    assert d["onepassword_queried"] is False
    assert "op://prod/key/cred" not in b.resolved_refs   # the whole point


def test_tainted_nonsensitive_is_allowed():
    _, t, b = _make()
    t.register("x")
    t.mark_tainted("x", "read_email")
    d = b.request("x", "op://low/info/cred", sensitive=False)
    assert d["decision"] == "issued"          # taint only gates SENSITIVE secrets
    assert "op://low/info/cred" in b.resolved_refs


def test_quarantined_agent_is_denied_everything():
    _, t, b = _make()
    t.register("x")
    t.quarantine("x")
    d = b.request("x", "op://low/info/cred", sensitive=False)
    assert d["decision"] == "denied"
