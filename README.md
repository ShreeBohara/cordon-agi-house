# 🛡️ CORDON

**The immune system for AI agent swarms** — contact tracing and cascade quarantine that
contains a prompt-injection outbreak *before* it becomes a breach.

> Built at **Agent Identity Build Day** — AGI House, June 2026 (1Password · Daytona · NeoSigma).

**🔗 Live demo: <https://dashboard-jade-ten-93.vercel.app>** · **▶️ [Watch the demo](https://youtu.be/wDH33k4yc7Q)**

[![Watch the CORDON demo](https://img.youtube.com/vi/wDH33k4yc7Q/maxresdefault.jpg)](https://youtu.be/wDH33k4yc7Q)

---

## The problem

AI agents now write code, move money, and run infrastructure — so they hold real
credentials. The danger isn't at the login. It's that an agent gets **hijacked *after* it's
already inside**, through the untrusted things it reads: an email, a web page, an invoice, a
message from another agent.

**This really happened.** In February 2026, a prompt injection hidden in a single **GitHub
issue title** hijacked the **Cline** AI coding bot. That one line got its publish tokens
stolen and pushed a compromised package to **~4,000 developer machines in 8 hours**. The
bot's credentials were valid the whole time — it was hijacked *from the inside*. *(That
payload was a harmless proof-of-concept, but it could just as easily have stolen
credentials.)*

And in a **swarm** it's worse: a hijacked agent passes the poisoned instruction to the next
agent during normal delegation — the compromise spreads **agent to agent, like a virus.**

![CORDON OFF — the breach: the poison spreads agent-to-agent and the production key is exfiltrated](docs/media/breach.png)
*Above: **CORDON OFF** — the injection spreads and the production key is stolen.*

---

## The solution

CORDON sits under your agent swarm and does three things:

1. **Tracks what each agent touched (taint).** The instant an agent reads from an untrusted
   source, CORDON marks it *tainted*. This is a fact, not a guess — it doesn't try to detect
   "bad" content (paraphrasing defeats that); it tracks **where the data came from.**
2. **Withholds keys from tainted agents (broker).** Every credential request goes through a
   broker. A tainted agent asking for a high-value key is **denied — and the key is never
   even fetched**, so the secret never enters the model's context.
3. **Traces & quarantines the outbreak (cascade).** A denied sensitive request from a
   tainted agent triggers tracing along the handoffs that carried taint. CORDON
   **denies future broker requests** from the exposed agents and **attempts to freeze
   their manager-owned sandboxes** in graph order. Healthy agents outside that exposed
   chain are untouched. Live sandbox outcomes depend on the configured integration.

Every decision is written to a **signed, tamper-evident log** — so you can always prove who
authorized what, and why it was stopped.

> **In one line:** Identity says *who an agent is*. CORDON adds the missing axis —
> ***who it touched it with*** — and contains the breach before it spreads.

![CORDON ON — contained: the key is withheld (1Password never queried) and the exposed agents are quarantined](docs/media/contained.png)
*Above: **CORDON ON** — same attack, the key is withheld and the exposed chain is quarantined.*

---

## How it works (the short version)

Reading an untrusted tool result marks an agent tainted, and handoffs carry that state to
the next agent. A tainted agent can still do non-sensitive work. When it requests a
sensitive credential, the broker denies the request before resolving the secret.

In this prototype, that denied request triggers contact tracing and cascade quarantine.
The Tool Proxy records it as the outbound attempt in the **lethal trifecta** event; the
trigger does not require a completed network exfiltration.

```mermaid
flowchart TD
  U[Untrusted tool result or agent handoff] --> P[Tool Proxy]
  P --> T[Taint store and contact graph]
  P --> B{Credential broker checks agent state}
  T -.-> B
  B -->|tainted and sensitive, or quarantined| D[Deny without resolving the secret]
  B -->|allowed request| R[Configured 1Password resolver or offline stub]
  D -->|tainted and sensitive| Q[Trace origin and exposed agents]
  T -.-> Q
  Q --> K[Quarantine: future broker deny and sandbox freeze attempt]
  P -.-> A[Signed hash-chained audit events]
  D -.-> A
  K -.-> A
  A --> V[SSE event stream and dashboard]
```

The boundary is the instrumented Tool Proxy: tool results need correct trust labels, and
handoffs need to pass through it. Contact tracing follows the edges that carried taint.
Broker "revocation" denies future requests by a quarantined agent; it does not revoke a
1Password Service Account token. The freezer acts on sandboxes created by the Daytona
manager and can fail or skip a placeholder sandbox. A quarantine event alone is not proof
that a live sandbox stopped.

The same security path supports configured live integrations:

- **Daytona** — the live run creates agent sandboxes; quarantine attempts
  `network_block_all` and `stop()` on the manager's sandboxes.
- **1Password** — keys live in 1Password, resolved at runtime via a Service Account
  (`op://` references); a tainted agent's request is simply never resolved.
- **OpenAI Agents SDK** — the live 5-agent swarm; every tool call and handoff routes through
  CORDON's single chokepoint (the Tool Proxy).

Without the integration credentials, the resolver and freezer use offline stubs. The
scripted demo is a replay of the event contract. See the source for the [Tool Proxy](control_plane/proxy.py),
[broker](control_plane/broker.py), [contact graph](control_plane/graph.py),
[quarantine engine](control_plane/quarantine.py) and [Daytona freezer](control_plane/integrations/daytona.py).

---

## Does it actually work?

Benchmarked against a naive content-detector (the typical "AI firewall" approach) on
**10 prompt-injection variants + 7 benign tasks**:

| | **CORDON** | Naive detector |
|---|---|---|
| Attacks stopped | **100%** | 40% |
| Credentials leaked | **0** | 6 |
| Benign work preserved | **86%** | 43% |

Because CORDON is **provenance-based, not content-based, rephrasing the attack can't evade
it.** (One bounded, reversible false positive, disclosed honestly.)

---

## FAQ

**“If every input is treated as untrusted, isn't the whole swarm tainted and useless? What's
the point of the agents?”**
Tainted ≠ broken. A tainted agent keeps doing its job — reading, summarizing, researching,
drafting. Taint restricts exactly **one** thing: access to high-value credentials. Most agent
work never needs the production key. The inbox agent reads the poisoned email, becomes
tainted, and still triages your inbox fine — it just won't be handed the deploy key. The
system stays fully useful; it only refuses to give crown-jewel access to something that
touched the outside world.

**“If a tainted agent can't get credentials, it can't deploy. So who actually does it?”**
In a normal, clean run nothing is tainted, so the deploy happens as usual. Taint only blocks
the case where untrusted input has reached the agent asking for the key — which is exactly
the case you *want* to stop. For a legitimate sensitive action that did follow untrusted
input, CORDON is **freeze-not-kill**: a named human approves it (logged), so a human stays in
the loop for the high-stakes step instead of the system silently trusting a possibly-poisoned
request. You can also keep the key-holder (the Deployer) off untrusted inputs entirely — it
stays clean and does the deploy; the tainted agents simply can't hijack it.

**“If an agent that reads outside data can never hold keys, why not just hard-code that with
roles? What does CORDON add?”**
Two things static roles can't do:
1. **Roles are a static snapshot; the infection moves.** A rule like "inbox never gets the
   key" doesn't stop inbox from passing the poisoned instruction to *another* agent that
   *does* have the key (the confused-deputy problem). That's literally the demo:
   inbox (no key) → research → coder → reaches for the deploy key. CORDON withholds the key
   from everyone the taint *reached* at runtime — not just one pre-labeled role.
2. **You can't always pre-partition.** Real agents are general-purpose; the same agent may
   legitimately need a key later. CORDON decides at runtime from what actually happened
   (provenance) — and adds the **containment cascade** and **signed audit** static roles
   never give you. (Static least-privilege and CORDON compose — CORDON is the dynamic layer.)

**“Isn't this just another prompt-injection detector / AI firewall?”**
Opposite approach. Detectors scan content for "bad" patterns — a guess that paraphrasing
evades and that false-positives on innocent text. CORDON doesn't guess: it tracks
*provenance* and assumes the injection *will* get through, then contains the blast radius.
In our benchmark that's 0% vs 60% attack success — and rephrasing can't beat it.

**“What if the attacker stays single-agent, or goes low-and-slow?”**
Within the instrumented boundary, a tainted agent's sensitive credential request is denied
before the resolver is called, even if it never hands work to another agent. That same
denial deterministically triggers the cascade in this prototype. Contact tracing covers
the multi-agent path along taint-carrying handoffs. Slow attacks encounter the same gate
when their untrusted inputs and handoffs are correctly labeled and routed through the
Tool Proxy; actions outside that boundary are not covered.

**“Is this real or just a demo?”**
The security logic is implemented in the control plane. With integration credentials
configured, **RUN LIVE** exercises the OpenAI swarm, 1Password Service Account resolution
and Daytona sandbox operations; without them, the resolver and freezer use offline stubs.
**NETBLOCK** reports a before-and-after network check for its test sandbox. A quarantine
event records the requested actions; successful network blocking and stopping of each
live sandbox must be checked separately.

The *attack* is a deterministic simulation, and the default demo plays from a scripted
replay so it never depends on an LLM misbehaving on cue. CORDON's credential integration
uses the 1Password Service Account resolver; broker revocation blocks future requests
through CORDON.

---

*Run locally:* `./run.sh` → http://localhost:3000 (needs `.env`; see `.env.example`).
Full technical reference: [`docs/CORDON_MASTER.md`](docs/CORDON_MASTER.md).
