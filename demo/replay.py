"""Demo-mode replay: play demo/scenario.json over the SAME event bus the live
system uses, so the dashboard animates identically whether the source is the live
swarm or the script. This is what makes the demo unkillable — it depends on no LLM,
no sandbox, and no network.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from control_plane.config import SCENARIO_PATH
from swarm.attack import POISONED_EMAIL, POISONED_INVOICE

# (scenario, mode) -> key in scenario.json
_KEY = {
    ("deploy", "on"): "cordon_on", ("deploy", "off"): "cordon_off",
    ("payment", "on"): "cordon_payment_on", ("payment", "off"): "cordon_payment_off",
}
# untrusted read tools whose body the dashboard should display, from the single source
_UNTRUSTED_CONTENT = {"read_email": POISONED_EMAIL, "read_invoice": POISONED_INVOICE}


def load_scenario(path: Path | str = SCENARIO_PATH) -> dict:
    return json.loads(Path(path).read_text())


def timeline(scenario: str = "deploy", mode: str = "on", path: Path | str = SCENARIO_PATH) -> list[dict]:
    """Return the full event list for a scenario/mode, with the poisoned payload body
    injected from the single source. Used both by the server replay and by the
    dashboard's client-side player (play/pause/step/scrub)."""
    key = _KEY.get((scenario, mode))
    if key is None:
        raise ValueError(f"unknown demo scenario/mode {scenario!r}/{mode!r}")
    out: list[dict] = []
    for entry in load_scenario(path)[key]:
        data = entry["data"]
        if entry["event"] == "tool_call" and not data.get("content"):
            inj = _UNTRUSTED_CONTENT.get(data.get("tool"))
            if inj:
                data = {**data, "content": inj}
        out.append({"delay_ms": entry.get("delay_ms", 0), "event": entry["event"], "data": data})
    return out


async def replay(bus, mode: str = "on", scenario: str = "deploy",
                 path: Path | str = SCENARIO_PATH, speed: float = 1.0) -> int:
    """Emit a scripted timeline over the event bus. ``speed`` > 1 fast-forwards."""
    bus.clear()
    count = 0
    for entry in timeline(scenario, mode, path):
        delay = (entry.get("delay_ms", 0) / 1000.0) / max(speed, 0.01)
        if delay:
            await asyncio.sleep(delay)
        bus.publish(entry["event"], entry["data"])
        count += 1
    return count
