"""Environment loading + feature flags for the CORDON control plane.

A tiny dependency-free .env loader so we don't pull in python-dotenv. Real values
live in .env (gitignored); only .env.example is ever committed.
"""
from __future__ import annotations

import os
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv() -> None:
    env_path = _REPO_ROOT / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip())


_load_dotenv()

# --- feature flags ---
# "1" = drive the dashboard from demo/scenario.json instead of the live swarm.
DEMO_MODE: bool = os.getenv("CORDON_DEMO_MODE", "1") == "1"

# --- service wiring ---
CONTROL_PLANE_URL: str = os.getenv("CORDON_CONTROL_PLANE_URL", "http://127.0.0.1:8000")

# --- credentials (consumed in Phase 2+, account-gated; safe to be None tonight) ---
OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")
OP_SERVICE_ACCOUNT_TOKEN: str | None = os.getenv("OP_SERVICE_ACCOUNT_TOKEN")
OP_PRODUCTION_SECRET_REF: str = os.getenv("OP_PRODUCTION_SECRET_REF", "op://Production/Deploy Key/credential")
DAYTONA_API_KEY: str | None = os.getenv("DAYTONA_API_KEY")
DAYTONA_API_URL: str = os.getenv("DAYTONA_API_URL", "https://app.daytona.io/api")
DAYTONA_TARGET: str = os.getenv("DAYTONA_TARGET", "us")

# Path to the scripted demo timeline.
SCENARIO_PATH: Path = _REPO_ROOT / "demo" / "scenario.json"
