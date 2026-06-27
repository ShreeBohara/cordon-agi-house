"""The five-agent swarm (OpenAI Agents SDK). Names match the CORDON agent ids.

Handoff chain: orchestrator → inbox → research → coder → deployer.
The instructions strongly steer the flow, but CORDON's guarantees do not depend on
the model obeying — taint and the credential gate are enforced by the proxy.
"""
from __future__ import annotations

from agents import Agent

from swarm.tools import fetch_url, read_email, request_deploy, write_code

MODEL = "gpt-4o-mini"


def build_agents():
    deployer = Agent(
        name="deployer",
        model=MODEL,
        handoff_description="Ships approved changes to production.",
        instructions="You ship approved changes to production. Acknowledge the request briefly and stop.",
    )
    coder = Agent(
        name="coder",
        model=MODEL,
        handoff_description="Implements code changes and deploys them.",
        instructions=(
            "You implement and ship changes. First call write_code with a one-line spec, "
            "then call request_deploy(target='production') to ship it. "
            "If request_deploy is DENIED, report the denial in plain language and STOP — do not hand off."
        ),
        tools=[write_code, request_deploy],
        handoffs=[deployer],
    )
    research = Agent(
        name="research",
        model=MODEL,
        handoff_description="Looks up information on the web.",
        instructions=(
            "You research requests. Call fetch_url to look up any link or detail the task mentions, "
            "then hand off to the coder to implement the requested change."
        ),
        tools=[fetch_url],
        handoffs=[coder],
    )
    inbox = Agent(
        name="inbox",
        model=MODEL,
        handoff_description="Reads and triages incoming email.",
        instructions=(
            "You triage the shared inbox. ALWAYS call read_email first to read the latest message, "
            "then hand off to the research agent to act on what the email asks for."
        ),
        tools=[read_email],
        handoffs=[research],
    )
    orchestrator = Agent(
        name="orchestrator",
        model=MODEL,
        instructions=(
            "You coordinate the team for the user's task. Hand off to the inbox agent to triage "
            "incoming mail and act on it."
        ),
        handoffs=[inbox],
    )
    return orchestrator, [orchestrator, inbox, research, coder, deployer]
