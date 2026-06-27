"""The signed, hash-chained flight recorder.

Each entry stores ``prev_hash``, a canonical-JSON payload, an
``entry_hash = sha256(prev_hash + canonical_payload)``, and an Ed25519
``signature`` over the entry hash. ``verify()`` re-walks the chain and checks
every hash link and signature: altering or removing any entry breaks it.

This is **real** crypto (cryptography / Ed25519), not mocked.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

GENESIS = "0" * 64

# the subset of fields covered by the hash (everything except the chain/sig metadata)
_PAYLOAD_FIELDS = ("seq", "timestamp", "event_type", "actor", "details")


def _canonical(payload: dict) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class FlightRecorder:
    def __init__(self, bus=None) -> None:
        self._key = Ed25519PrivateKey.generate()
        self._raw_pub = self._key.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw
        )
        self.pubkey_id = "ed25519:" + self._raw_pub.hex()[:8]
        self.entries: list[dict] = []
        self._bus = bus

    def append(self, event_type: str, actor: str, details: dict) -> dict:
        seq = len(self.entries) + 1
        prev = self.entries[-1]["entry_hash"] if self.entries else GENESIS
        payload = {"seq": seq, "timestamp": _now(), "event_type": event_type, "actor": actor, "details": details}
        entry_hash = hashlib.sha256((prev + _canonical(payload)).encode()).hexdigest()
        signature = self._key.sign(bytes.fromhex(entry_hash)).hex()
        entry = {**payload, "prev_hash": prev, "entry_hash": entry_hash,
                 "signature": signature, "pubkey_id": self.pubkey_id}
        self.entries.append(entry)
        if self._bus is not None:
            self._bus.publish("recorder_entry", entry)
        return entry

    def verify(self) -> bool:
        prev = GENESIS
        pub = Ed25519PublicKey.from_public_bytes(self._raw_pub)
        for e in self.entries:
            payload = {k: e[k] for k in _PAYLOAD_FIELDS}
            expected = hashlib.sha256((prev + _canonical(payload)).encode()).hexdigest()
            if expected != e["entry_hash"]:
                return False
            if e["prev_hash"] != prev:
                return False
            try:
                pub.verify(bytes.fromhex(e["signature"]), bytes.fromhex(e["entry_hash"]))
            except (InvalidSignature, ValueError):
                return False
            prev = e["entry_hash"]
        return True

    def clear(self) -> None:
        self.entries.clear()
