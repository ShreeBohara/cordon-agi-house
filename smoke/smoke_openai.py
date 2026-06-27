"""Phase 0 smoke test — OpenAI Agents SDK: run a one-line agent.

Reads OPENAI_API_KEY from .env.
Run:  cordon/.venv/bin/python smoke/smoke_openai.py   (from the cordon/ dir)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_env = Path(__file__).resolve().parent.parent / ".env"
if _env.exists():
    for _line in _env.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

if not os.getenv("OPENAI_API_KEY"):
    print("✗ OPENAI_API_KEY not set in .env")
    sys.exit(1)

from agents import Agent, Runner  # noqa: E402

agent = Agent(
    name="Smoke",
    instructions="You are a smoke test. Reply with exactly: CORDON online",
    model="gpt-4o-mini",
)

result = Runner.run_sync(agent, "ping")
print(f"  model replied: {result.final_output!r}")
print("✓ OpenAI Agents SDK smoke test PASSED")
