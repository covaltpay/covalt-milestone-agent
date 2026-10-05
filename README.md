# Covalt Autonomous Milestone Coordinator

> Autonomous orchestration agent for rule-bound, non-custodial milestone Pacts using the Covalt Agent Gateway.

## Agent Execution Wall

The agent is an orchestration layer, not a wallet.

- Never receives card numbers, bank credentials or private payment credentials.
- Never stores or holds customer funds.
- Recipient registration comes from the authoritative Covalt API.
- Pact state, verification, release and settlement remain authoritative in Covalt.
- Evidence is submitted to Covalt; the agent never decides whether evidence satisfies a condition.
- Creating a Pact does not mean that money has been paid.
- Human authorization/funding remains required wherever Covalt requires it.
- Production mode has no simulated payment fallback.

## Architecture

[ Work / Project Brief ] -> [ Covalt Milestone Agent ] -> [ Covalt Pact API / Agent Gateway ] -> [ Verification / Release / Settlement ] -> [ Payment Rails ]

The agent tools are register_recipient, create_pact, send_invitation, submit_milestone_evidence, and get_trust_timeline.

## Work integration

Production service endpoints:
- GET /health
- POST /v1/coordinate

Work authenticates server-to-server with AGENT_SHARED_SECRET. The agent uses its own server-side COVALT_API_KEY. Secrets never reach the browser.

The coordinate endpoint accepts a natural-language request plus optional structured Work context and returns the agent response and authoritative Covalt tool results.

## Configuration

Provide ANTHROPIC_API_KEY, ANTHROPIC_MODEL, COVALT_API_KEY, COVALT_BASE_URL, AGENT_SHARED_SECRET and PORT.

## Running

bun install
bun run build
bun run start

The CLI remains available with: bun run cli

## Safety

The agent fails closed. If Covalt rejects an operation, the agent reports the authoritative error rather than simulating success or inventing a fallback.
