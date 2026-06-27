"""The signed hash-chained flight recorder: clean chain verifies, any tamper fails."""
from __future__ import annotations

from control_plane.recorder import FlightRecorder


def _three():
    r = FlightRecorder()
    r.append("tainted", "inbox", {"source": "read_email"})
    r.append("credential_denied", "broker", {"agent_id": "coder"})
    r.append("quarantine_complete", "cordon", {"quarantined": ["inbox", "research", "coder"]})
    return r


def test_clean_chain_verifies():
    assert _three().verify() is True


def test_tampered_details_breaks_chain():
    r = _three()
    r.entries[1]["details"] = {"agent_id": "deployer"}
    assert r.verify() is False


def test_removed_entry_breaks_chain():
    r = _three()
    del r.entries[1]
    assert r.verify() is False


def test_tampered_signature_breaks_chain():
    r = _three()
    sig = list(r.entries[0]["signature"])
    sig[0] = "0" if sig[0] != "0" else "1"
    r.entries[0]["signature"] = "".join(sig)
    assert r.verify() is False
