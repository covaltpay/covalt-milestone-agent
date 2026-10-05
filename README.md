# Covalt Autonomous Milestone Coordinator

> An open-source reference agent that turns project briefs and deliverables into rule-bound, non-custodial milestone Pacts using the Covalt Agent Gateway.

[![Covalt MCP](https://img.shields.io/badge/MCP-Registry%20Active-teal)](https://github.com/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## The Problem
AI agents can generate code, draft scopes, and schedule meetings, but they cannot safely handle payments. Handing an LLM a raw Stripe API key or corporate card invites unlimited blast radius, prompt injection attacks, and unrecoverable fund transfers.

## How Covalt Solves This
This reference agent enforces the **Agent Execution Wall**:
1. **Proposal, Not Custody:** The agent drafts structured agreements (`Pacts`) with clear milestones, deadlines, and cryptographic intent hashes.
2. **Deterministic Rail Lock:** The client authorizes the commitment through a secure human-in-the-loop approval link. Funds remain safely on the payment rail (Stripe/GoCardless). Covalt never holds or pools client money.
3. **Evidence-Gated Release:** Payout instructions execute only when milestone proof (e.g. GitHub PR merged, preview deployed) is recorded on the Trust Timeline and approved.

---

## Architecture

```text
[ Project Brief / Linear Issue ]
               │
               ▼
   [ Milestone Coordinator Agent ]
   (Claude 3.5 Sonnet / LangChain)
               │
               ▼ MCP Tools
      ┌─────────────────────────┐
      │  propose_pact           │ ──> Generates SHA-256 Intent Hash
      │  submit_evidence        │ ──> Appends proof to Trust Timeline
      │  get_trust_timeline     │ ──> Verifies milestone status
      └────────────┬────────────┘
                   │
                   ▼
       [ Human Approval Link ]
       https://covaltpay.com/pact/P10...
                   │
                   ▼
      [ Deterministic Rail Payout ]
