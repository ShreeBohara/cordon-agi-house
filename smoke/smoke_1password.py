"""Phase 0 smoke test — 1Password Service Account: authenticate + resolve one secret.

Reads OP_SERVICE_ACCOUNT_TOKEN and OP_PRODUCTION_SECRET_REF from .env.
Never prints the secret value (only a masked preview).

Run:  cordon/.venv/bin/python smoke/smoke_1password.py   (from the cordon/ dir)
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

# minimal .env loader (no extra deps)
_env = Path(__file__).resolve().parent.parent / ".env"
if _env.exists():
    for _line in _env.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

from onepassword.client import Client  # noqa: E402


async def main() -> None:
    token = os.getenv("OP_SERVICE_ACCOUNT_TOKEN")
    ref = os.getenv("OP_PRODUCTION_SECRET_REF", "op://Production/Deploy Key/credential")

    if not token:
        print("✗ OP_SERVICE_ACCOUNT_TOKEN is not set in .env")
        sys.exit(1)
    if not token.startswith("ops_"):
        print(f"⚠ token does not start with 'ops_' (got '{token[:4]}…') — check you copied the Service Account token")

    print("→ authenticating service account…")
    client = await Client.authenticate(
        auth=token, integration_name="CORDON", integration_version="v1.0.0"
    )

    print(f"→ resolving {ref} …")
    value = await client.secrets.resolve(ref)

    masked = (value[:2] + "…" + value[-2:]) if len(value) >= 4 else "••••"
    print(f"✓ resolved a real secret ({len(value)} chars): {masked}")
    print("✓ 1Password smoke test PASSED")


if __name__ == "__main__":
    asyncio.run(main())
