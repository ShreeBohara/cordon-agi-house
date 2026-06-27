"""Full deterministic spine: the headless attack-to-containment run.

This pins the ordered event contract that Phase 3's live swarm must reproduce.
"""
from __future__ import annotations

from control_plane.main import build_system, run_canonical


def test_full_spine_outcome():
    out = run_canonical(build_system())
    assert out["decision"] == "denied"
    assert out["sensitive_secret_resolved_for_tainted"] is False   # core guarantee
    assert out["patient_zero"] == "inbox"
    assert out["quarantined"] == ["inbox", "research", "coder"]
    assert out["recorder_valid"] is True


def test_full_spine_event_order():
    s = build_system()
    run_canonical(s)
    types = [e["event"] for e in s.bus.history]

    assert types.index("tainted") < types.index("credential_denied") \
        < types.index("patient_zero_confirmed") < types.index("quarantine_started")

    q_ids = [e["data"]["agent_id"] for e in s.bus.history if e["event"] == "agent_quarantined"]
    assert q_ids == ["inbox", "research", "coder"]   # in order, deployer never quarantined
