"""Phase 0a smoke tests — confirm the harness, package imports, and contract load."""
from __future__ import annotations

import json
from pathlib import Path


def test_package_imports():
    from control_plane import config, main, models  # noqa: F401

    assert main.app.title == "CORDON Control Plane"
    assert hasattr(models, "EventType")


def test_event_contract_has_all_types():
    from control_plane.models import EventType

    # 12 from the plan's §8 + 2 deliberate additions (scenario_started, credential_exfiltrated)
    assert len(list(EventType)) == 14


def test_scenario_json_matches_contract():
    """Every event in scenario.json must be a known EventType."""
    from control_plane.models import EventType

    known = {e.value for e in EventType}
    scenario = json.loads((Path(__file__).resolve().parent.parent / "demo" / "scenario.json").read_text())
    timelines = [k for k in scenario if k.startswith("cordon_")]
    assert {"cordon_on", "cordon_off", "cordon_payment_on", "cordon_payment_off"} <= set(timelines)
    for key in timelines:
        for entry in scenario[key]:
            assert entry["event"] in known, f"{key}: unknown event {entry['event']}"
            assert "delay_ms" in entry and "data" in entry
