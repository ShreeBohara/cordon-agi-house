"""Phase 2a integration test — REAL 1Password behind the broker.

Skipped automatically when no Service Account token is configured, so the offline
unit suite stays green. Requires OP_SERVICE_ACCOUNT_TOKEN + OP_PRODUCTION_SECRET_REF
in .env (and network).
"""
from __future__ import annotations

import os

import pytest

from control_plane.broker import Broker
from control_plane.events import EventBus
from control_plane.integrations import onepassword as op
from control_plane.taint import TaintStore

pytestmark = pytest.mark.skipif(not op.is_configured(), reason="no OP_SERVICE_ACCOUNT_TOKEN configured")

REF = os.getenv("OP_PRODUCTION_SECRET_REF", "op://CORDON/Deploy Key/credential")


def _broker():
    bus = EventBus()
    taint = TaintStore()
    return bus, taint, Broker(taint=taint, bus=bus, resolver=op.resolve)


def test_healthy_agent_resolves_a_real_secret():
    _, taint, broker = _broker()
    taint.register("deployer")
    decision = broker.request("deployer", REF, sensitive=True)
    assert decision["decision"] == "issued"
    assert isinstance(decision["value"], str) and len(decision["value"]) > 0  # a real secret came back
    assert REF in broker.resolved_refs


def test_tainted_agent_denied_without_calling_1password():
    _, taint, broker = _broker()
    taint.register("coder")
    taint.mark_tainted("coder", "read_email")
    decision = broker.request("coder", REF, sensitive=True)
    assert decision["decision"] == "denied"
    assert decision["onepassword_queried"] is False
    assert broker.resolve_calls == []  # 1Password was never even called
