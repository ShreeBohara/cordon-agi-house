# CORDON

**Contact tracing and cascade quarantine for AI agent swarms — the immune system for agent swarms.**

Agents get compromised *after* they are inside, through untrusted inputs (a poisoned
email, a web page, a tool result, another compromised agent). In a swarm the
infection spreads along normal delegation, like a virus. CORDON tracks provenance
(taint), withholds credentials from tainted agents at a broker (the secret never
enters the model's context), and when an agent trips the lethal trifecta it traces
the contact graph and revokes + freezes the exposed sub-graph in infection order —
all written to a signed, hash-chained flight recorder.

> Built for **Agent Identity Build Day** (AGI House, 2026-06-27), sponsored by
> 1Password, Daytona & NeoSigma.

---

## Quick start

```bash
./run.sh          # boots control plane + dashboard, health-checks both, prints the URL
# → open http://localhost:3000
# flip CORDON OFF (breach) then ON (contained), or click RUN LIVE for the real swarm
./stop.sh         # stop both (or Ctrl+C in the run.sh terminal)
```

Requires `.env` with `OPENAI_API_KEY`, `OP_SERVICE_ACCOUNT_TOKEN`, `DAYTONA_API_KEY`
(see `.env.example`). The scripted demo (OFF/ON) runs fully offline; RUN LIVE needs the keys.

---

## Contract-first, demo-first

The build is decoupled by one artifact: the **event contract**. The dashboard only
ever sees an SSE event stream, so it can be built entirely against a scripted replay
**before the live swarm exists**.

- [`EVENT_CONTRACT.md`](EVENT_CONTRACT.md) — the spec (read this first).
- [`control_plane/models.py`](control_plane/models.py) — Python (Pydantic) shapes.
- [`dashboard/lib/events.ts`](dashboard/lib/events.ts) — TypeScript mirror.
- [`demo/scenario.json`](demo/scenario.json) — the scripted demo timelines
  (deploy + payment, each off/on).

This means two tracks can proceed in parallel:
- **Backend** — control plane (Tool Proxy *first*), then real Daytona + 1Password, then the swarm.
- **Dashboard** — built against `scenario.json` replay; never blocked on the live swarm.

## What is real vs mocked

- **Real:** Daytona sandbox create/freeze/kill/network-block; 1Password secret
  resolve via Service Accounts + SDK; all the security *logic* (taint, broker-deny,
  contact graph, cascade, signed log).
- **Mocked (and we say so):** the 1Password Credential Broker *agent path* (private
  beta, not GA for agents) — CORDON prototypes 1Password's own published **Unified
  Access** roadmap (runtime scoped issuance + agent audit) on top of GA Service
  Accounts; programmatic revoke (modeled as broker-deny); the prompt-injection
  attack (deterministic); and the demo itself (`scenario.json` replay).

## Status — shipped

- [x] Event contract (Python + TypeScript)
- [x] Deterministic core — taint, broker, contact graph, cascade, signed Ed25519 flight recorder
- [x] Real integrations — 1Password (Service Account resolve) + Daytona (sandbox freeze / network-block)
- [x] OpenAI agent swarm behind the Tool Proxy + deterministic attack
- [x] Live dashboard — contact graph, vault lock-snap, flight recorder, poisoned-email card
- [x] Two attack scenarios — **DEPLOY** (poisoned email) and **PAYMENT** (poisoned invoice)
- [x] Eval benchmark (provenance vs. naive detector) + live Daytona network-isolation proof
- [x] Timeline player (play / pause / step / scrub / speed) + one-command `run.sh`

See [`docs/CORDON_MASTER.md`](docs/CORDON_MASTER.md) for the full reference (architecture, every feature, integrations, research, demo script, judge Q&A).
