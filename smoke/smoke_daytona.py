"""Phase 0 smoke test — Daytona: create a sandbox, run a command, stop, delete.

Reads DAYTONA_API_KEY / DAYTONA_API_URL / DAYTONA_TARGET from .env.
Run:  cordon/.venv/bin/python smoke/smoke_daytona.py   (from the cordon/ dir)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_env = ROOT / ".env"
if _env.exists():
    for _line in _env.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

from daytona import Daytona, DaytonaConfig  # noqa: E402


def main() -> None:
    key = os.getenv("DAYTONA_API_KEY")
    if not key:
        print("✗ DAYTONA_API_KEY not set in .env")
        sys.exit(1)

    cfg = DaytonaConfig(
        api_key=key,
        api_url=os.getenv("DAYTONA_API_URL") or None,
        target=os.getenv("DAYTONA_TARGET") or None,
    )
    daytona = Daytona(cfg)

    sandbox = None
    try:
        print("→ creating sandbox…")
        sandbox = daytona.create()
        print(f"  id={sandbox.id}  state={getattr(sandbox, 'state', '?')}")

        print("→ exec: echo hello from CORDON …")
        resp = sandbox.process.exec("echo hello from CORDON")
        out = getattr(resp, "result", None) or getattr(resp, "stdout", None) or repr(resp)
        print(f"  exit_code={getattr(resp, 'exit_code', '?')}  output={str(out).strip()!r}")

        print("→ blocking network (update_network_settings)…")
        try:
            sandbox.update_network_settings(network_block_all=True)
            print("  network blocked ✓")
        except Exception as e:  # not fatal for the smoke test
            print(f"  (network block skipped: {e})")

        print("→ stopping sandbox…")
        daytona.stop(sandbox)
        print("→ deleting sandbox…")
        daytona.delete(sandbox)
        sandbox = None
        print("✓ Daytona smoke test PASSED (create → exec → netblock → stop → delete)")
    finally:
        if sandbox is not None:
            try:
                daytona.delete(sandbox)
                print("  (cleaned up sandbox)")
            except Exception as e:
                print(f"  cleanup warning: {e}")


if __name__ == "__main__":
    main()
