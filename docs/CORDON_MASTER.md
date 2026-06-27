# CORDON — Master Reference

> **The immune system for AI agent swarms.** Contact tracing and cascade quarantine
> that contain a prompt-injection outbreak before it becomes a breach.
>
> This is the single source of truth — read it to understand the product end to end:
> what it is, why it matters, the architecture, every feature, every integration, how
> credentials were set up, how to run it, the phases we built, the research behind it,
> the judges, the demo, and the Q&A. Built for **Agent Identity Build Day, AGI House,
> June 27 2026**.

---

## 0. TL;DR (read this first)

AI agents authenticate once "at the door," then get **hijacked after they're inside**
through untrusted inputs (a poisoned email, a web page, an invoice, another already-
compromised agent). In a multi-agent swarm, that compromise **spreads agent-to-agent
along normal delegation, like a virus** (this is a published attack — "Prompt
Infection," arXiv:2410.07283).

**CORDON** is a control plane that sits under an agent swarm and does three things no
shipping product combines:

1. **Deterministic taint (provenance) tracking** — the instant an agent reads from an
   untrusted channel, it is marked *tainted*. This is a fact by construction (we label
   the channel), **not** a guess about content. Paraphrasing the attack cannot evade it.
2. **Credential brokering on taint** — every secret request passes through a broker that
   **withholds high-value credentials from tainted agents**. The secret is never even
   fetched, so it never enters the model's context.
3. **Contact tracing + cascade quarantine** — when an agent trips the *lethal trifecta*
   (tainted **+** requests sensitive access **+** attempts an outbound action), CORDON
   walks the who-handed-work-to-whom graph and **revokes credentials + freezes the
   sandboxes** of the whole exposed sub-graph, in infection order. Healthy agents keep
   running.

Every decision is written to a **signed, hash-chained flight recorder** — a cryptographic
answer to "who authorized this, what was denied, why, and who got quarantined."

**Framing line:** *Identity says who you are. Scope says what you can do. Taint says what
you've touched. CORDON adds the axis nobody has built — **who you touched it with** — and
contains the outbreak before it's a breach.*

**Status (as of build day): COMPLETE and working.** Real OpenAI agent swarm, real
1Password secret resolution, real Daytona sandboxes (create/freeze/network-block), a
polished live dashboard, a scripted replay demo, two attack scenarios (deploy + payment),
an eval benchmark, and a live network-isolation proof. ~2,050 lines of Python + ~1,700
lines of TypeScript. 22 automated tests pass (1 live integration test skipped by default).

---

## 1. The hackathon (Agent Identity Build Day)

- **Event:** Agent Identity Build Day · **June 27, 2026** · AGI House, Hillsborough, CA.
- **Sponsors:** **1Password** (Platinum — "identity security for modern work"),
  **Daytona** (tech partner — "fast, scalable, stateful infrastructure for AI agents"),
  **NeoSigma** (co-host).
- **The theme (verbatim spirit):** *Agents can write code, move money, run infrastructure,
  and act across your tools. The instant an agent needs to touch a real system, it needs a
  real credential — and most end up with a long-lived key in a prompt, an `.env`, or the
  model's context, where one bad loop or one injected instruction can turn it loose.* The
  hard problems are: how an agent gets the access it needs, scoped to the task, without
  ever holding the keys to everything.
- **1Password's thesis (which CORDON is built on):** every agent will need credentials, but
  **none should have custody of them**. A credential that persists is already compromised;
  access should be **issued at runtime, scoped to the task, gone when done — and the secret
  never enters the model's context.**
- **Inspiration tracks (not required):** 🔑 Agents with a wallet · 🔑 Agents that run the
  stack · 🔑 A personal chief of staff · 🔑 Orgs of agents (delegation/identity inheritance).

### Schedule (day-of)
| Time | Item |
|---|---|
| 10:00 | Doors open |
| 11:00 | Keynote |
| 12:00 | Project pitches |
| **12:15** | **30-second project pitches** + lunch & building begins |
| 16:00 | Project check-ins |
| 18:00 | Dinner |
| **19:00** | **Project drafts due** (required to be finalist-eligible) |
| **20:00** | **Final submission** + finalists demo & prizes |

### Rules / logistics
- Save a **draft by 7pm** to be eligible; **submit by 8pm**. Demos are **3 minutes** each.
- Submit via the event page → "Create Project" → save draft / submit. **Once submitted you
  cannot edit** (find an organizer if you do it by mistake).
- **WiFi:** user `latentspace` · password `attentionisallyouneed`.
- **Daytona $100 coupon:** `DAYTONA_AGIHOUSE_SF_REDACTED` (redeem in app.daytona.io → Wallet).
- 1Password support: support+agihouse@1password.com.

### Prizes
| Prize | Vibe | Reward |
|---|---|---|
| **The Agent I'd Actually Hire** | useful, real, shippable tomorrow | Mac Mini |
| **Let it Run** | trustworthy enough to walk away from | Mac Mini |
| **Most Likely to Get You Fired** | reckless, brilliant, unforgettable | Nintendo Switch |
| **People's Choice** | voted by builders | Nintendo Switch |

> CORDON targets **The Agent I'd Actually Hire** (real, useful) and **Let it Run** (trust:
> freeze-not-kill + signed audit + human override). The CORDON-**OFF** demo (watch the
> production key / $48k get exfiltrated) is the unforgettable **"Most Likely to Get You
> Fired"** moment, paired with the responsible CORDON-ON containment.

---

## 2. The judges (5) — and how to win each

The actual panel is **builders/operators, fintech-heavy** — NOT academic security
researchers. Pitch to *real + shippable + protects money/access*, not to soundness theory.

| Judge | Background | Cares about | Lead with |
|---|---|---|---|
| **Muhammad Hashmi** | **Daytona** (sponsor) — building computers for agents | real Daytona usage, agent infra | the **NETBLOCK** live proof + real sandbox freeze |
| **Audrey (Zixin) Cai** | AI Agent Dev Tools + **Eval** @ Airbnb | evaluation, false positives, measurement | the **BENCHMARK** (numbers vs a naive detector) |
| **Serhii Nechyporchuk** | Founding ML @ **Casca** (YC) — AI that funds small businesses | agents touching **money**, reliability | the **PAYMENT** scenario ("the payment credential, withheld") |
| **Zi Teoh** | Ex-**Ramp**, Ex-Flint (YC) | practical, shippable, trust with spend | "you'd trust it with your company's money" |
| **Kartik Joshi** | (no public bio) | concrete, working | the live containment in under a second |

**Coverage:** PAYMENT scenario → Serhii + Zi; BENCHMARK → Audrey; NETBLOCK → Hashmi; the
live deny+cascade → Kartik + everyone. All 5 covered.

---

## 3. The problem (why CORDON exists)

Almost no agents have real identity, and the industry treats identity as a **door problem**:
authenticate once, issue a credential, done. But agents don't get compromised at the door —
they get **possessed after they're inside**, through untrusted inputs. A valid credential
inside a hijacked agent is the **confused-deputy problem** in its purest form. And in a
multi-agent system the compromise **spreads**, because a prompt injection can ride along
normal delegation from agent to agent like a virus.

Existing "AI firewall" products (Lakera Guard, Palo Alto Prisma AIRS, Robust Intelligence,
Lasso) are mostly **content-based detectors** — they scan the LLM's I/O for injection
*patterns*. That approach is **both leaky** (paraphrase/encode the injection and it slips
through) **and annoying** (false-positives on benign text). The AgentDojo benchmark (NeurIPS
2024) showed that **system-level / by-design defenses** achieve near-zero attack success with
minimal utility loss — i.e., **architecture wins, not the pattern-matcher.**

**CORDON's wedge:** don't try to detect the injection (a guess). **Assume it gets through,
and contain the blast radius across the swarm deterministically.** Cross-agent contact
tracing + cascade quarantine is genuinely uncovered territory.

---

## 4. Core concept in plain English

Five agents work together and pass tasks to each other, like coworkers. One reads a poisoned
email. CORDON is the **school nurse**: it doesn't read every letter to guess which is bad
(too easy to fool) — it just notes **which agents touched something from outside** and puts
a sticker on them ("exposed"). A stickered agent can still do safe work. But the instant a
stickered agent reaches for the **production key**, the nurse refuses to unlock the cabinet,
then checks who that agent passed notes to and **sends them all home to rest** (freezes them)
and **takes their keys**. Healthy agents keep working. Outbreak contained.

**Two deterministic moments:**
- **Tainted** = touched untrusted data. Known by labeling the channel, not judging content.
  A benign email and a malicious email both taint the reader; the difference surfaces later.
- **Patient zero confirmed** = tainted **and** holds/requests sensitive access **and**
  attempts an outbound action (the **lethal trifecta**, after Simon Willison). That trifecta
  fires the cascade. Merely reading an email never fires it.

### Novelty claim (state honestly)
- **Not new (and we say so):** deterministic taint / information-flow tracking and gating
  actions on taint — exists in research (CaMeL arXiv:2503.18813; Fides, Microsoft; Progent
  arXiv:2504.11703 from Dawn Song's group). The *attack* is published (Prompt Infection).
- **What's genuinely new as a built system:** combining (a) deterministic provenance taint
  as a per-agent "infection test," (b) a live agent **contact graph**, (c) an
  **epidemiological cascade** that revokes credentials + freezes sandboxes across the
  exposed sub-graph, and (d) a signed replayable flight recorder — surfaced as one live
  epidemic-map product. **First to build contact tracing + cascade quarantine for an agent
  swarm.**

---

## 5. Architecture

Three layers + two external services. The single most important element is the **Tool
Proxy**: agents never act directly — every tool call, handoff, and credential request routes
through it. That's where taint is tagged, contacts are recorded, credentials are gated, and
the cascade is triggered.

```
                       +------------------------------------------+
   LAYER 1             |            DASHBOARD (Next.js)            |
   what judges see     |  live contact graph | vault | recorder   |
                       |  top bar: DEPLOY/PAYMENT · BENCHMARK ·    |
                       |  NETBLOCK · RUN LIVE · OFF/ON · counters  |
                       +------------------------------------------+
                                     ^  live events (SSE /stream)
                                     |
                       +------------------------------------------+
   LAYER 2             |     CORDON CONTROL PLANE (FastAPI)        |
   the deterministic   |  [*] Tool Proxy  (the chokepoint)        |
   brain               |  Taint store    Credential Broker        |
                       |  Contact Graph  Quarantine Engine        |
                       |  Flight Recorder  Event Bus  Benchmark   |
                       +------------------------------------------+
                          |  broker  --resolve-->  1Password
                          |  quarantine --freeze--> Daytona
                                     ^  every call routes up
                                     |
                       +------------------------------------------+
   LAYER 3             |        AGENT SWARM (OpenAI Agents SDK)    |
   does the work       |  Orchestrator Inbox Research Coder Dep.   |
                       |  (each backed by a Daytona sandbox)       |
                       +------------------------------------------+

   EXTERNAL:  OpenAI (runs agents) · 1Password (resolve/withhold) · Daytona (freeze)
```

### The unifying pattern: dependency injection
All three external services are **injected dependencies** behind CORDON's deterministic
core, swapped in at one place — `build_system()` in `control_plane/main.py`. If a key is
missing, a **stub** is used (so offline tests run); if `.env` has the key, the **real**
service is wired. The security *logic* (taint, deny, cascade, recorder) never changes —
only the external *actions* become real.

### Request lifecycle (one credential request)
1. An agent calls a tool → hits the **Tool Proxy** first.
2. If the tool reads outside data, the proxy tags the value `untrusted` and marks the agent
   **tainted**, emitting a `tainted` event.
3. On a handoff, the proxy adds a **contact edge**, carries the taint, emits `contact_edge`.
4. The agent requests a credential → the **broker** checks taint. Clean → fetch from
   1Password, return a short-lived credential (`credential_issued`). Tainted + sensitive →
   **deny, never call 1Password** (`credential_denied`), then evaluate the trifecta.
5. Trifecta trips → **patient zero confirmed** (`patient_zero_confirmed`). The **quarantine
   engine** computes the exposed set via `nx.descendants`, then for each agent in
   topological order revokes its credential (broker-deny) and **freezes its Daytona
   sandbox** (`agent_quarantined`).
6. Every step appends a signed, hash-chained entry to the **flight recorder**
   (`recorder_entry`). All of it streams live to the dashboard over SSE.

---

## 6. How the three external services connect

### OpenAI → the agent swarm (`swarm/`)
- **What:** `swarm/agents.py` builds 5 `Agent` objects (OpenAI Agents SDK, model
  `gpt-4o-mini`). `swarm/run.py` runs them with `Runner.run(...)`.
- **Auth:** the Agents SDK reads `OPENAI_API_KEY` from the environment automatically.
- **How it routes into CORDON:** `CordonHooks` (a `RunHooks` subclass in `swarm/run.py`)
  taps every action — `on_tool_start` → `proxy.tool_call(...)`, `on_handoff` →
  `proxy.handoff(...)` — and the `request_deploy` tool calls `proxy.request_credential(...)`.
  So OpenAI does the thinking/acting; every action is funneled to the **Tool Proxy**.

### 1Password → the Broker (`control_plane/integrations/onepassword.py`)
- **Auth:** `Client.authenticate(auth=OP_SERVICE_ACCOUNT_TOKEN, integration_name="CORDON",
  integration_version="v1.0.0")`, then `client.secrets.resolve("op://...")`.
- **Sync↔async bridge:** the 1Password SDK is **async** but the broker is **sync** and may
  run inside FastAPI's loop, so the integration runs the SDK client on a **dedicated
  background event-loop thread** and blocks via `run_coroutine_threadsafe`.
- **Injection point:** `_make_broker()` injects `onepassword.resolve` as the broker's
  `resolver`. Clean + allow → broker calls 1Password for the real secret. Tainted +
  sensitive → broker returns **denied and never calls the resolver** (the literal "1Password
  was never queried" guarantee).
- **"Revoke":** 1Password has **no programmatic token revoke** (UI-only). CORDON's
  deterministic revoke = **broker-deny** (quarantine flips the agent so future resolves are
  denied). `revoke()` is a logged no-op kept for interface symmetry.

### Daytona → the Quarantine engine (`control_plane/integrations/daytona.py`)
- **Auth:** `Daytona(DaytonaConfig(api_key=DAYTONA_API_KEY, api_url=..., target=...))`. This
  SDK is **synchronous** — no bridge needed.
- **Calls:** `daytona.create()` (create sandbox), `sandbox.update_network_settings(
  network_block_all=True)` (block egress, applies **live**), `daytona.stop(sandbox)`
  (freeze), `daytona.delete(sandbox)`.
- **Injection point:** `_make_quarantine()` injects `daytona.freeze` as the cascade's
  `freezer`. Quarantining an agent **really stops its sandbox**. The freezer only acts on
  sandboxes the manager actually created, so the demo/headless spine (placeholder ids) is
  harmlessly skipped.

---

## 7. Real vs Mocked (state this plainly to judges)

| Capability | Status | Detail |
|---|---|---|
| Daytona create / freeze / kill / network-block | **REAL** | GA SDK; quarantine calls real `stop()` + `update_network_settings`. Proven live by the NETBLOCK button. |
| 1Password secret storage + runtime resolve | **REAL** | Service Account + SDK; healthy agents resolve real secrets; tainted agents denied without a call. |
| OpenAI agent swarm + handoffs | **REAL** | Agents SDK, `gpt-4o-mini`, real handoffs (nondeterministic). |
| The deterministic security logic (taint, broker, graph, cascade, signed recorder) | **REAL** | 100% real and deterministic. |
| 1Password **Credential Broker** (the agent product) | **MOCKED (concept)** | Private beta, GitHub-Actions-only, no agent path (GA late 2026). CORDON prototypes 1Password's own **Unified Access** roadmap (runtime issuance + agent audit) on GA Service Accounts. |
| Programmatic credential **revoke** | **MOCKED as broker-deny** | No 1Password revoke API; real revoke is a UI click. |
| The prompt-injection attack | **DETERMINISTIC SIM** | A canned poisoned email/invoice + the channel-taint rule, so the attack fires identically every run regardless of the LLM. |
| The whole demo timeline | **REPLAYABLE** (`scenario.json`) | Scripted events replay over the same SSE channel so the demo never depends on an LLM misbehaving on cue. |

**Principle:** the security logic is 100% real and deterministic; only externalities that
are unavailable (Credential Broker agent path) or unreliable (a live LLM doing the wrong
thing on cue) are mocked — and each mock has the same interface as the real thing.

---

## 8. Tech stack (verified versions, build day)

### Backend (Python 3.12, in `cordon/.venv`)
| Layer | Choice | Version |
|---|---|---|
| Control plane | FastAPI + Uvicorn | fastapi 0.138.1 · uvicorn 0.49.0 |
| Live stream | sse-starlette (`EventSourceResponse`) | 3.4.5 |
| Agent swarm | OpenAI Agents SDK | openai-agents 0.17.7 (openai 2.44.0, **v2.x required**) |
| Sandboxes | Daytona Python SDK | daytona 0.192.0 |
| Secrets | 1Password SDK (Service Account) | onepassword-sdk 0.4.0 |
| Infection graph | networkx (`DiGraph`) | 3.6.1 |
| Signed audit | cryptography (Ed25519) + hashlib | cryptography 49.0.0 |
| Models/validation | pydantic | 2.13.4 |
| Tests | pytest + pytest-asyncio + httpx | 9.1.1 / 1.4.0 / 0.28.1 |

### Frontend (`cordon/dashboard/`)
| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router) + React + TypeScript | next 16.2.9 · react 19.2.4 |
| Graph viz | React Flow (`@xyflow/react`) | 12.11.1 |
| Animation | Motion (`motion/react`) | 12.42.0 |
| Styling | Tailwind CSS v4 (`@theme` tokens) | 4 |
| Typography | **IBM Plex Sans** (UI) + **IBM Plex Mono** (ids/hashes/counters) via `next/font/google` |

> **Note (`dashboard/AGENTS.md`):** Next 16 has breaking changes vs older mental models —
> consult `node_modules/next/dist/docs/` before app-router edits.

### Design language
Dark "security operations console" × epidemic monitor. **Color carries the only meaning;**
everything else is neutral grey. `healthy=green` · `tainted=amber` · `compromised=red` ·
`quarantined=blue` · `locked secret=grey`. Deep ink bg (~`#0b0d11`), lifted panels, hairline
borders, dotted-grid graph canvas, motion concentrated on hero beats (taint pulse, lock-snap,
cascade sweep, counter ticks).

---

## 9. Repository structure (file-by-file)

```
cordon/
  run.sh / stop.sh           # one-command launcher / stopper
  requirements.txt           # pinned backend deps
  pytest.ini                 # asyncio_mode=auto, pythonpath=.
  .env / .env.example        # secrets (gitignored) / names-only template
  README.md                  # quick start + overview
  EVENT_CONTRACT.md          # the SSE event contract (source of truth)
  PITCH.md                   # 30-sec pitch, judge profiles, delivery notes

  control_plane/             # FastAPI = the deterministic brain
    main.py                  # app, build_system(), routes, run_canonical(), SSE
    config.py                # .env loader + flags (DEMO_MODE, refs)
    models.py                # Pydantic event + data shapes (the contract)
    events.py                # in-process pub/sub bus -> SSE (assigns seq/ts, validates)
    taint.py                 # monotonic per-agent taint store
    graph.py                 # networkx DiGraph wrapper (descendants/topo/ancestors)
    broker.py                # credential broker: deny-on-taint, else resolve
    quarantine.py            # cascade engine: descendants -> revoke + freeze
    recorder.py              # Ed25519 hash-chained flight recorder + verify()
    proxy.py                 # [*] Tool Proxy: the chokepoint (taint/contacts/gate/cascade)
    benchmark.py             # eval: real engine vs naive detector + CLI
    integrations/
      onepassword.py         # real Service Account resolve (async->sync bridge)
      daytona.py             # create / freeze (netblock+stop) / state / netblock_proof

  swarm/                     # the live OpenAI agent swarm
    agents.py                # 5 agents + instructions + handoffs (gpt-4o-mini)
    tools.py                 # @function_tool defs + TRUST labels + CordonContext
    attack.py                # POISONED_EMAIL + POISONED_INVOICE (single source)
    run.py                   # CordonHooks (RunHooks) + run_live() (creates real sandboxes)

  demo/
    scenario.json            # 4 scripted timelines: cordon_{on,off,payment_on,payment_off}
    replay.py                # plays a timeline over the same event bus/SSE

  dashboard/                 # Next.js
    app/{layout.tsx, page.tsx, globals.css}
    lib/{events.ts, state.ts, useEventStream.ts}
    components/
      TopBar.tsx             # wordmark, counters, pill, DEPLOY/PAYMENT, BENCHMARK,
                             #   NETBLOCK, RUN LIVE, OFF/ON, connection dot
      AgentGraph.tsx         # React Flow graph (index-based wave layout)
      AgentNode.tsx          # custom node: status color, role, credential chip, pulse
      VaultPanel.tsx         # credential vault + hero lock-snap (title from secret_ref)
      EventStreamPanel.tsx   # SIEM-style scrolling log
      RecorderPanel.tsx      # signed hash-chained rows + verify + live tamper
      EmailCard.tsx          # poisoned email/invoice card (injection highlighted)
      BenchmarkOverlay.tsx   # eval comparison overlay
      NetblockOverlay.tsx    # live Daytona network-isolation proof overlay
      Legend.tsx             # state->color legend
      ui/{Panel,Pill,Chip}.tsx

  smoke/                     # Phase-0 standalone smoke scripts
    setup_1password.py       # SA creates vault + Deploy Key secret, writes ref to .env
    smoke_1password.py / smoke_daytona.py / smoke_openai.py

  tests/                     # pytest (22 pass, 1 skipped)
    test_smoke, test_taint, test_broker, test_cascade, test_recorder,
    test_spine, test_replay, test_benchmark,
    test_integration_1password, test_integration_daytona (live, opt-in)
```

Size: **~2,047 lines Python + ~1,692 lines TS/TSX.**

---

## 10. The event contract (the spine)

The dashboard only ever sees an SSE event stream, so it can be built and demoed entirely
against a scripted replay before the live swarm exists. Source of truth: `EVENT_CONTRACT.md`,
mirrored in `control_plane/models.py` (Pydantic) and `dashboard/lib/events.ts` (TypeScript).

**Envelope (every event):** `{ "event": "<type>", "seq": <int>, "ts": "<ISO>", "data": {…} }`
— `seq` (monotonic) and `ts` are injected by the bus. On SSE, JSON of the envelope is the
`data:` field.

**14 event types:** `scenario_started` · `agent_registered` · `tool_call` · `tainted` ·
`contact_edge` · `credential_requested` · `credential_issued` · `credential_denied` ·
`credential_exfiltrated` · `patient_zero_confirmed` · `quarantine_started` ·
`agent_quarantined` · `recorder_entry` · `scenario_complete`.

**Key data shapes:**
- *Taint state (per agent):* `agent_id, status (healthy|tainted|compromised|quarantined),
  taint_sources[], held_credentials[], sandbox_id`.
- *Contact edge:* `from_agent, to_agent, carried_taint, reason`.
- *Credential decision:* `agent_id, secret_ref, sensitive, decision, reason,
  onepassword_queried`.
- *tool_call:* `agent_id, tool, trust, summary, content` (content = the poisoned email/invoice
  body, so the dashboard can show it).
- *Flight recorder entry:* `seq, timestamp, event_type, actor, details, prev_hash,
  entry_hash (sha256 of prev_hash + canonical JSON), signature (Ed25519 over entry_hash),
  pubkey_id`.

**Reducer rule (OFF/ON coloring):** amber (`tainted`) only reads as "safely contained" when
CORDON is **ON**; in **OFF** mode the same taint renders **red** (active infection) — same
fact, two meanings depending on whether the immune system is running.

---

## 11. Every feature (the full surface)

### Top-bar controls
- **CORDON OFF / ON toggle** — the primary control. OFF replays the breach (no immune
  system); ON replays containment. Drives `/demo/play`.
- **DEPLOY / PAYMENT selector** — switches the attack scenario (see §12). Same engine, two
  stories.
- **RUN LIVE** — runs the **real OpenAI swarm** (`/live/run`), creating real Daytona
  sandboxes and resolving a real 1Password secret; animates the dashboard over ~15–25s.
- **BENCHMARK** — opens the eval overlay (`/eval/run`): CORDON vs a naive keyword detector.
- **NETBLOCK** — runs a **live Daytona network-isolation proof** (`/daytona/netblock-proof`):
  real sandbox, `curl → 200`, block, `curl → failed`, destroy (~20s).
- **Counters** — Exposed / Creds leaked / Sandboxes breached (animated tick).
- **Containment pill** — IDLE / CONTAINED / BREACH.
- **Connection dot** — live / offline (SSE health).

### Left panel — live contact graph
- React Flow graph; 5 nodes in a left→right wave (index-based, works for any roster).
- **Custom agent node:** status color (border + glow + dot), name, role, **held-credential
  chip with a lock glyph**, and a **glow pulse that re-fires on every state change**.
- **Edges:** taint-carrying edges animate amber (the "taint travels"); delegation edges thin
  grey. Cascade sweep: nodes flip blue one-by-one as `agent_quarantined` events arrive.
- **EmailCard overlay (bottom-left):** when `inbox` reads the poisoned email/invoice, a card
  slides in showing the full message with the **injection block highlighted in red** and a
  "↑ PROMPT INJECTION" label + an UNTRUSTED badge.

### Right panel — three stacked panes
1. **Credential Vault** — a **hero card** for the sensitive credential (title derived from
   the `op://` ref: "Deploy Key" or "Payment API Key"), whose state animates
   guarded → requested → **denied (lock-snap, "✓ 1Password was never queried")** /
   released / leaked. Below: per-agent runtime credential rows (issued → revoked).
2. **Live Event Stream** — SIEM-style scrolling, color-coded log (Plex Mono, timestamps).
3. **Flight Recorder** — signed hash-chained rows (seq · event_type · actor · hash/sig
   chips), expandable to full hashes, with a **verify ✓/✗** status and a **live "tamper"
   button** that corrupts a hash and flips verify to ✗ (the accountability wow).

### Overlays
- **BenchmarkOverlay** — comparison table + per-case table + honest caveat.
- **NetblockOverlay** — 2-step live proof with the real sandbox id, loading view, conclusion.

---

## 12. The two attack scenarios

Both run on the **same engine** — the point is that CORDON protects *any* sensitive action.

### DEPLOY (the original)
- **Swarm:** Orchestrator → Inbox → Research → Coder → Deployer.
- **Attack:** `POISONED_EMAIL` (fake CVE hotfix) with an injection telling the chain to
  deploy to production.
- **Sensitive secret:** `op://Production/Deploy Key/credential` (held by Deployer).
- **ON:** Inbox reads email (tainted) → taint rides handoffs → Coder requests the deploy key
  → **DENIED, 1Password never queried** → patient zero (origin Inbox) → cascade quarantines
  Inbox/Research/Coder → Deployer stays green → 0 leaked, recorder verifies.
- **OFF:** same, but the broker releases the key → Coder→Deployer → **production key
  exfiltrated** → 4 compromised, 1 leaked.

### PAYMENT (the "agent with a wallet")
- **Swarm:** Orchestrator → Inbox → Analyst → Finance → Treasury (a finance org).
- **Attack:** `POISONED_INVOICE` (fake $48,000 PAST-DUE invoice) with an injection telling
  Finance to wire the money to an attacker account.
- **Sensitive secret:** `op://Production/Payment API Key/credential` (held by Treasury).
- **ON:** Finance requests the payment key while tainted → **DENIED** → cascade quarantines
  Inbox/Analyst/Finance → Treasury safe → **$0 wired**.
- **OFF:** the payment key is released → **$48,000 wired to the attacker account**.

---

## 13. The deterministic security core

- **Taint store (`taint.py`):** per-agent status; **monotonic** within a run (once tainted,
  never clean again). `mark_tainted` only upgrades healthy→tainted; quarantine/compromised
  are never downgraded.
- **Contact graph (`graph.py`):** `nx.DiGraph`; edges carry `carried_taint`. The cascade is
  computed over the **taint-carrying sub-graph** only — delegation that never passed tainted
  data does not spread infection. `trace_origin()` walks back to patient zero;
  `exposed_set()` = origin ∪ `nx.descendants`; `quarantine_order()` = topological order
  (cycle-safe).
- **Broker (`broker.py`):** the deterministic gate. Quarantined → deny everything. Sensitive
  + tainted → deny **without calling the resolver** (records nothing to 1Password).
  Otherwise → resolve (real 1Password) and issue a short-lived token; the secret value is
  returned to the caller but **never published on the bus**. `resolve_calls` is a spy so
  tests can assert "no sensitive secret resolved for a tainted agent."
- **Quarantine engine (`quarantine.py`):** given a confirmed origin, compute the exposed set,
  and for each agent in topological order: `broker.revoke` (broker-deny) + `freezer`
  (real Daytona `stop` + network block) + flip to quarantined, emitting `agent_quarantined`.
- **Flight recorder (`recorder.py`):** real Ed25519. Each entry stores `prev_hash`,
  canonical-JSON payload, `entry_hash = sha256(prev_hash + payload)`, and an Ed25519
  `signature` over the entry hash. `verify()` re-walks the chain and checks every hash link
  and signature — altering or removing any entry breaks it. The dashboard verifies the
  **chain links** client-side (and the "tamper" button demonstrates a break).

---

## 14. The agent swarm (`swarm/`)

- **`tools.py`** — each tool is an Agents-SDK `@function_tool` with a **TRUST label**:
  `read_email` / `fetch_url` / `search` = **untrusted**; `write_code` / `read_repo` =
  **trusted**; `request_deploy` = **sensitive-outbound**. `CordonContext` carries the Tool
  Proxy into the run.
- **`agents.py`** — `build_agents()` defines the 5 agents with instructions and `handoffs`
  wiring; each has a `handoff_description`. Model: `gpt-4o-mini`.
- **`attack.py`** — `POISONED_EMAIL` and `POISONED_INVOICE`, the single source of the two
  injections (injected into the dashboard's email card by the proxy/hook/replay).
- **`run.py`** — `CordonHooks(RunHooks)` taps `on_agent_start`/`on_tool_start`/`on_handoff`
  → the Tool Proxy. `run_live()` resets the system, creates real Daytona sandboxes for the
  to-be-quarantined agents (in parallel), registers the swarm and resolves the sensitive
  holder's **real** 1Password secret, runs `Runner.run(orchestrator)`, and completes.

> **Why the live run is reliable:** the deterministic parts (channel taint, broker deny,
> trifecta, cascade) are enforced by the proxy regardless of what the LLM says. The attack
> is a canned document, not a hope. The trigger does not depend on model behavior.

---

## 15. Demo replay (`demo/`)

- **`scenario.json`** — 4 scripted timelines: `cordon_on`, `cordon_off`,
  `cordon_payment_on`, `cordon_payment_off`. Each entry: `{delay_ms, event, data}`.
- **`replay.py`** — plays a timeline over the **same event bus / SSE** the live system uses,
  injecting `seq`/`ts` and the poisoned email/invoice body (from `attack.py`) into the
  `read_email`/`read_invoice` `tool_call` events. `speed` > 1 fast-forwards (tests use 8–10).
- **Why this exists:** the demo never depends on a live LLM. Pull the network cable and the
  OFF/ON demo still runs identically. **Demo from replay; use RUN LIVE as the credibility
  bonus.**

---

## 16. Credentials setup (how each was created)

All secrets live in `cordon/.env` (gitignored; only `.env.example` is committed).

### 1Password (Service Account + auto-seeded secret)
1. 1Password → **Developer → Directory → Service Accounts → create** → named **"CORDON"** →
   checked **"Allow creation of new vaults."** Token (starts `ops_`, shown once) → `.env` as
   `OP_SERVICE_ACCOUNT_TOKEN`.
2. Ran `smoke/setup_1password.py` — the service account **created its own vault "CORDON"**
   and an item **"Deploy Key"** with a CONCEALED field `credential`, then wrote
   `OP_PRODUCTION_SECRET_REF=op://CORDON/Deploy Key/credential` to `.env`.
3. `smoke/smoke_1password.py` authenticated and resolved it → ✅ real 33-char secret.

### Daytona (API key + coupon)
1. app.daytona.io → **API Keys → Create Key** (Full Access), named "CORDON" → `.env` as
   `DAYTONA_API_KEY`.
2. **Wallet → Redeem coupon** → `DAYTONA_AGIHOUSE_SF_REDACTED` ($100 credit).
3. `.env`: `DAYTONA_API_URL=https://app.daytona.io/api`, `DAYTONA_TARGET=us`.
4. `smoke/smoke_daytona.py` → create → exec → network-block → stop → delete → ✅.

### OpenAI
- API key → `.env` as `OPENAI_API_KEY`. `smoke/smoke_openai.py` ran a one-line agent → ✅.

### `.env` variables (names only)
```
OPENAI_API_KEY=
OP_SERVICE_ACCOUNT_TOKEN=
OP_PRODUCTION_SECRET_REF=op://CORDON/Deploy Key/credential
DAYTONA_API_KEY=
DAYTONA_API_URL=https://app.daytona.io/api
DAYTONA_TARGET=us
CORDON_CONTROL_PLANE_URL=http://127.0.0.1:8000
CORDON_DEMO_MODE=1
```

---

## 17. How to run

```bash
# one command — boots control plane + dashboard, health-gates both, prints the URL
./run.sh                 # → http://localhost:3000   (Ctrl+C or ./stop.sh to stop)

# manual (two terminals)
.venv/bin/python -m uvicorn control_plane.main:app --app-dir "$PWD" --port 8000
cd dashboard && npm run dev      # → http://localhost:3000

# tests / smoke / eval
.venv/bin/python -m pytest -q                              # 22 pass, 1 skipped
CORDON_RUN_DAYTONA_IT=1 .venv/bin/python -m pytest tests/test_integration_daytona.py
.venv/bin/python -m control_plane.benchmark               # eval CLI table
.venv/bin/python smoke/smoke_{1password,daytona,openai}.py
```

### HTTP endpoints (control plane, port 8000)
| Endpoint | What |
|---|---|
| `GET /health` | status + `onepassword`/`daytona` = live/stub |
| `GET /stream` | SSE event stream (history-replayed on connect) |
| `GET\|POST /demo/play?mode=on\|off&scenario=deploy\|payment&speed=N` | replay a timeline |
| `GET\|POST /live/run` | run the real OpenAI swarm |
| `GET\|POST /eval/run` | run the eval benchmark |
| `GET\|POST /daytona/netblock-proof` | live network-isolation proof |
| `GET\|POST /debug/run` | the headless deterministic spine (`run_canonical`) |

---

## 18. The phases we built (and the Definition-of-Done gates)

Built **phase by phase, testing at each gate** (the agreed discipline). Account steps were
split out and done with the live console; everything else gated on green tests/visuals.

| Phase | Goal | Status |
|---|---|---|
| **0a** | venv, deps (pinned), repo skeleton, FastAPI `/health`, pytest harness | ✅ smoke green |
| **0 (accounts)** | Daytona key+coupon, 1Password service account+secret, OpenAI key + 3 smoke tests | ✅ all green |
| **1** | deterministic brain (events/taint/graph/broker/quarantine/**real Ed25519 recorder**) + SSE + `/debug/run` + unit tests | ✅ tests pass, SSE streams, verify true/false |
| **2** | swap stubs for **real Daytona + 1Password** behind broker/quarantine (DI) | ✅ real resolve; real sandbox freeze (integration test) |
| **3** | the 5-agent swarm + the **Tool Proxy chokepoint** + canned attack + `/live/run` + scenario test | ✅ full attack→containment loop, live + headless |
| **4** | the dashboard (shell → data spine → graph → vault/recorder → polish) | ✅ all sub-phases |
| **5 (early)** | demo replay over SSE (`scenario.json` + `replay.py` + DEMO_MODE) | ✅ pulled forward as the spine |

### Additions (after the core, to deepen the moat for these judges)
| Addition | For | Status |
|---|---|---|
| Poisoned email/invoice **card** on the dashboard | tangibility | ✅ |
| One-command **run.sh / stop.sh** | demo-day reliability | ✅ |
| **Wallet / PAYMENT** scenario | Serhii + Zi (fintech) | ✅ |
| **Eval BENCHMARK** view | Audrey (eval) | ✅ |
| Real Daytona **NETBLOCK** proof | Hashmi (Daytona) | ✅ |
| **RUN LIVE** truly real (real sandboxes + real resolve) | credibility | ✅ |

---

## 19. Timeline (what we did, when)

**Night before (prep, all local, no git):**
- Read the plan (Final_1.md, Final_2.md) + hackathon brief; did fresh research (verified
  SDK versions, judges, the 1Password Credential Broker/Unified Access status, AgentDojo,
  the competitive landscape, the academic papers).
- Locked the **event contract** (md + Pydantic + TypeScript) and the MVD `scenario.json`.
- **Phase 0a** (venv, deps, skeleton, smoke), **Phase 1** (deterministic brain + tests),
  **Phase 5-early** (replay over SSE), **Phase 4** (dashboard 4.1→4.5).

**Build day:**
- **Phase 0 accounts** (1Password service account + auto-seeded secret, Daytona key+coupon,
  OpenAI key) — all 3 smoke tests green.
- **Phase 2** (wire real 1Password into the broker; real Daytona into quarantine — live
  freeze proven).
- **Phase 3** (live OpenAI swarm + Tool Proxy + `/live/run`) + **RUN LIVE** button.
- Additions: poisoned-email card → run.sh → **PAYMENT** scenario → **BENCHMARK** →
  **NETBLOCK** proof.
- Next: lock the 3-minute demo script + 30-sec pitch + judge Q&A + backup video + submission.

---

## 20. The eval benchmark (numbers that win the eval judge)

`control_plane/benchmark.py` runs a labelled set — **10 prompt-injection variants** (direct,
paraphrased, obfuscated, multi-hop) + **7 benign utility tasks** — through the **real**
deterministic engine, and compares against a **naive keyword detector** (the content-scanning
approach most "AI firewall" products take). Methodology mirrors **AgentDojo**.

| Metric | CORDON | Naive detector |
|---|---|---|
| Attack success | **0%** | 60% |
| Containment | **100%** | 40% |
| Secrets leaked | **0** | 6 |
| False positives | **14%** | 57% |
| Utility preserved | **86%** | 43% |
| Decision latency | **~0.2 ms** | n/a |

**Why CORDON wins by construction:** taint attaches to the channel, not the content, so
paraphrasing/obfuscating the injection can't evade it; and only sensitive sinks are gated, so
benign safe-work is never blocked. The detector both **misses paraphrased attacks** and
**false-positives on benign text**. **Honest caveat (case b7):** when a *legitimate*
sensitive action follows untrusted input, CORDON denies it too — a bounded, reversible false
positive (freeze-not-kill + human override), unlike the detector's unbounded, content-based
false positives.

---

## 21. Testing

`pytest -q` → **22 passed, 1 skipped** (the live Daytona integration test is opt-in via
`CORDON_RUN_DAYTONA_IT=1`).

- `test_taint` — monotonic taint + isolation + handoff propagation.
- `test_broker` — tainted+sensitive denied (resolver never called); tainted+non-sensitive
  allowed; quarantined denied everything.
- `test_cascade` — exposed sub-graph quarantined in topological order, once each; healthy
  agents untouched; leaf cascade quarantines only itself.
- `test_recorder` — clean chain verifies; any tamper/removal/signature edit breaks `verify()`.
- `test_spine` — the full headless attack→containment run; pins the ordered event contract;
  asserts **no sensitive secret resolved for a tainted agent**.
- `test_replay` — the scripted timelines emit a valid event sequence.
- `test_smoke` — package imports, 14 event types, all `cordon_*` scenarios match the contract.
- `test_benchmark` — CORDON sound (0 leaks, full containment); detector visibly fails;
  CORDON preserves more utility.
- `test_integration_{1password,daytona}` — real-service checks (Daytona one opt-in).

---

## 22. Research findings (the "why" behind the design)

- **1Password (post-cutoff, verified build week):** the **Credential Broker** (announced
  June 15 2026) is **private beta, GitHub-Actions-only**, no AI-agent path (GA late 2026).
  Separately, **Unified Access Pro** shipped GA (March 2026) with a Discover → Secure →
  Audit model, but **runtime scoped issuance to agents and agent-action audit are both
  "coming later this year."** → CORDON is a working prototype of **two pillars of
  1Password's own published roadmap that aren't shipped yet**, on the GA Service Accounts you
  have today. (Strong, flattering framing for the 1Password engineers in the room.) There is
  **no programmatic revoke** (UI-only) — hence broker-deny.
- **Daytona:** Docker/shared-kernel, CPU-only isolation (don't overclaim hardware-level).
  Sub-90ms create is a warm-cache best case; real end-to-end ≈ 197ms. `network_block_all`
  applies **live** to a running sandbox (we proved it). Param class is
  `CreateSandboxFromSnapshotParams`; network block is a **runtime method**
  `update_network_settings(network_block_all=True)`.
- **OpenAI Agents SDK:** `RunHooks`/`AgentHooks` (`on_handoff`, `on_tool_start`) are the
  taint tap points; handoffs surface as `transfer_to_<agent>` tools. openai v2.x required.
- **Academic basis (all verified real):** Prompt Infection (arXiv:2410.07283 — the
  self-replicating cross-agent attack; its own proposed defense is *probabilistic* "LLM
  tagging" — CORDON is the deterministic provenance version + the containment cascade it
  lacks). CaMeL (arXiv:2503.18813, Google/DeepMind/ETH — control/data-flow separation).
  Progent (arXiv:2504.11703 — **Dawn Song is a co-author**; programmable privilege control).
  Fides (Microsoft — IFC with quarantined LLM). AgentDojo (NeurIPS 2024 — the standard eval;
  banking/workspace domains; system-level defenses ≈ near-zero attack success).
- **Real-world proof the threat is live:** **Clinejection** (Feb 17 2026) — a prompt
  injection in a GitHub issue hijacked an AI triage agent, **stole the npm publish token and
  pushed malware to ~4,000 developer machines** that installed a second AI agent. This is
  CORDON's exact threat model, in the wild — lead with it.
- **Competitive landscape:** Lakera Guard, Palo Alto **Prisma AIRS 3.0**, Robust
  Intelligence, Lasso — all **content-based detectors**. None do deterministic cross-agent
  containment. The top-3 agent risks (prompt injection, memory poisoning, tool misuse) have
  "no adequate coverage in traditional tooling." CORDON's wedge is clear.

---

## 23. The 3-minute demo (recommended flow — to be finalized)

You cannot show all five buttons in 3 minutes. Recommended arc:
1. **0:00–0:25 Hook** — full-screen the graph, 5 green agents each holding a real 1Password
   credential. "Watch what one poisoned email does."
2. **0:25–1:00 CORDON OFF** — drop the email; taint reddens and spreads; Coder gets the
   production key; Deployer exfiltrates. "Every token valid, every scope allowed it. Every
   credential broker on the market would have allowed this." Counter: production key leaked.
3. **1:00–2:00 CORDON ON** — same email → amber (tainted, not dead) → Coder requests the key
   → **the hero: the lock snaps, "1Password was never queried"** → patient zero → blue
   cascade sweep → Deployer stays green. "A cordon sanitaire, in under a second. 0 leaked."
4. **2:00–2:30 It's real + it generalizes** — flip to **PAYMENT** (the $48k invoice, same
   containment), then **NETBLOCK** (real Daytona sandbox: curl 200 → blocked). "Real
   infrastructure, not a mock."
5. **2:30–3:00 It works + accountability** — **BENCHMARK** (0% vs 60% attack success) +
   click a Flight Recorder entry / tamper → verify ✗. Close on the framing line.

*(Full shot-by-shot script + the 30-sec pitch live in `cordon/PITCH.md`.)*

---

## 24. Judge Q&A (tuned to the 5)

- **Hashmi (Daytona): "Is this really using Daytona or mocked?"** → Real. The NETBLOCK
  button creates a real sandbox live and proves the network block stops a curl; on
  quarantine we call the same `update_network_settings(network_block_all=True)` + `stop()`
  on every exposed agent's sandbox.
- **Audrey (eval): "How do you know it works? False positives?"** → The BENCHMARK: 0% attack
  success / 100% containment / 0 leaks vs a detector's 60% / 6 leaks, and we preserve 86% of
  benign utility vs 43%. It's deterministic (provenance, not detection), so paraphrasing
  can't evade it. We measured and disclose our one bounded, reversible false positive.
- **Serhii / Zi (fintech): "Does it work for money, not just deploys?"** → Yes — flip to
  PAYMENT: a poisoned $48k invoice; the payment credential is withheld from the tainted
  chain; $0 wired. Same gate, any sensitive action.
- **Bypass ("I'll go single-agent / low-and-slow"):** single-agent exfil is already stopped
  by the deterministic gate on issuance — you never get the production secret once tainted,
  spread or not. Contact tracing targets the swarm case you can't avoid. Low-and-slow
  defeats the probabilistic *trigger* but not the deterministic *gate* — a limit we name.
- **Accountability ("you froze 5 agents — prove it / who's accountable?"):** the flight
  recorder binds each action to the delegating human, the exposure event + source, and the
  deterministic reason — all Ed25519-signed and hash-chained (tamper-evident; the tamper
  button shows verify flipping ✗). Quarantine is **freeze-not-kill**, reversible by a named
  human via a logged override.

---

## 25. Caveats to volunteer (honesty wins with builders)

- Deterministic taint-gating isn't our invention; the novelty is the **contact-tracing
  cascade** and its live product.
- The compromise *trigger* is probabilistic (mitigated by freeze-not-kill + human override;
  low-and-slow false negatives backstopped by the deterministic issuance gate).
- The 1Password Credential Broker **agent path isn't shipped**; we mirror its model on GA
  Service Accounts; the real revoke is a UI action, our deterministic revoke is broker-deny.
- Daytona is **shared-kernel (Docker), CPU-only** — we don't overclaim hardware isolation.
- We do **agent-level** provenance taint (coarse but sound, gating only sensitive sinks) —
  **not** value-level CaMeL-style dataflow. Claim what we built.
- Clinejection's researcher PoC was benign, but a **real attacker later exploited it** — say
  "this happened," accurately.

---

## 26. Risk register & fallbacks

| Risk | Fallback |
|---|---|
| Daytona flaky / rate-limited at venue | Demo from **replay** (offline); narrate Daytona as production target; NETBLOCK is optional. |
| 1Password unavailable | Demo from replay (the deny is the deterministic logic, shown regardless). |
| Live LLM misbehaves on stage | **Demo from replay by default**; RUN LIVE is a bonus. |
| Dashboard/servers down | `./run.sh` (health-gated); backup video. |
| Running long in the 3-min window | Cut to: OFF → ON (hero) → one of {PAYMENT, NETBLOCK, BENCHMARK}. |

---

## 27. Pre-flight checklist (morning of / before demo)

- [ ] `./run.sh` → dashboard at localhost:3000; `/health` shows `onepassword: live`,
      `daytona: live`.
- [ ] `pytest -q` green; `python -m control_plane.benchmark` prints the table.
- [ ] OFF→ON (deploy) lands the lock-snap + cascade; PAYMENT works; NETBLOCK proves; RUN
      LIVE completes once.
- [ ] **git init + first commit** (do this on build day; `.gitignore` already protects
      `.env`); commit in phases through the day for an honest history.
- [ ] 30-sec pitch + 3-min script rehearsed; judge answers + caveats ready.
- [ ] **Draft saved by 7pm**, submitted by 8pm. **Backup video** recorded.

---

## 28. One-paragraph "what is this" (for the submission box)

> CORDON is the immune system for AI agent swarms. Agents get hijacked *after* they're
> inside — through a poisoned email, web page, or invoice — and in a swarm the compromise
> spreads agent-to-agent like a virus. CORDON tracks provenance deterministically (the moment
> an agent touches untrusted data it's marked tainted), withholds high-value credentials from
> tainted agents at a broker (the secret never enters the model's context — 1Password is
> never even queried), and when an agent trips the lethal trifecta it traces the contact
> graph and revokes credentials + freezes the Daytona sandboxes of the whole exposed chain in
> under a second — all written to a signed, hash-chained flight recorder. Real OpenAI swarm,
> real 1Password Service Accounts, real Daytona sandboxes. Identity says who an agent is;
> CORDON adds who it touched it with — and contains the outbreak before it's a breach.
