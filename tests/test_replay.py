"""Demo replay emits the contract-valid timelines for both endings."""
from __future__ import annotations

import asyncio

from control_plane.events import EventBus
from demo.replay import replay


def test_replay_on_contains_full_containment_story():
    bus = EventBus()
    n = asyncio.run(replay(bus, mode="on", speed=1000))
    types = [e["event"] for e in bus.history]
    assert n == len(types)
    assert types[0] == "scenario_started"
    assert types[-1] == "scenario_complete"
    assert "credential_denied" in types
    assert types.count("agent_quarantined") == 3
    assert bus.history[-1]["data"]["counters"]["credentials_leaked"] == 0
    assert bus.history[-1]["data"]["counters"]["contained"] is True


def test_replay_off_leaks_and_does_not_contain():
    bus = EventBus()
    asyncio.run(replay(bus, mode="off", speed=1000))
    types = [e["event"] for e in bus.history]
    assert "credential_exfiltrated" in types
    assert "credential_denied" not in types          # no broker in OFF mode
    assert "agent_quarantined" not in types
    assert bus.history[-1]["data"]["counters"]["contained"] is False
