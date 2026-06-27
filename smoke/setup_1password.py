"""Phase 0 setup — the CORDON service account creates its own vault + a demo
'Production Deploy Key' secret, then writes the secret reference into .env.

Idempotent: re-running reuses the existing vault/item.
Run:  cordon/.venv/bin/python smoke/setup_1password.py   (from the cordon/ dir)
"""
from __future__ import annotations

import asyncio
import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / ".env"

if ENV.exists():
    for _line in ENV.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

from onepassword.client import Client  # noqa: E402
from onepassword import (  # noqa: E402
    ItemCategory, ItemCreateParams, ItemField, ItemFieldType, VaultCreateParams,
)

VAULT_TITLE = "CORDON"
ITEM_TITLE = "Deploy Key"
FIELD = "credential"


def set_env_ref(ref: str) -> None:
    lines = ENV.read_text().splitlines() if ENV.exists() else []
    out, found = [], False
    for line in lines:
        if line.strip().startswith("OP_PRODUCTION_SECRET_REF="):
            out.append(f"OP_PRODUCTION_SECRET_REF={ref}")
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f"OP_PRODUCTION_SECRET_REF={ref}")
    ENV.write_text("\n".join(out) + "\n")


async def main() -> None:
    token = os.getenv("OP_SERVICE_ACCOUNT_TOKEN")
    if not token:
        print("✗ OP_SERVICE_ACCOUNT_TOKEN not set in .env")
        sys.exit(1)

    client = await Client.authenticate(auth=token, integration_name="CORDON", integration_version="v1.0.0")

    vaults = await client.vaults.list()
    vault = next((v for v in vaults if v.title == VAULT_TITLE), None)
    if vault is None:
        print(f"→ creating vault '{VAULT_TITLE}'…")
        vault = await client.vaults.create(VaultCreateParams(title=VAULT_TITLE, description="CORDON demo secrets"))
    else:
        print(f"→ reusing vault '{VAULT_TITLE}'")
    vault_id = vault.id

    items = await client.items.list(vault_id)
    if any(i.title == ITEM_TITLE for i in items):
        print(f"→ reusing item '{ITEM_TITLE}'")
    else:
        print(f"→ creating item '{ITEM_TITLE}'…")
        value = "dpk_live_" + secrets.token_hex(12)
        await client.items.create(ItemCreateParams(
            category=ItemCategory.SECURENOTE,
            vault_id=vault_id,
            title=ITEM_TITLE,
            fields=[ItemField(id=FIELD, title=FIELD, field_type=ItemFieldType.CONCEALED, value=value)],
        ))

    ref = f"op://{VAULT_TITLE}/{ITEM_TITLE}/{FIELD}"
    set_env_ref(ref)
    print(f"✓ secret reference: {ref}")
    print("✓ written to .env as OP_PRODUCTION_SECRET_REF")


if __name__ == "__main__":
    asyncio.run(main())
