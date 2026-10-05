import Anthropic from "@anthropic-ai/sdk";
import { createPact, getTimeline, registerRecipient, sendInvitation, submitVerificationRequest } from "./covalt.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY environment variable is required.");

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const tools: Anthropic.Tool[] = [
  {
    name: "register_recipient",
    description: "Register the intended payout recipient in Covalt. Registration never verifies the recipient or makes it payout-eligible.",
    input_schema: {
      type: "object",
      properties: {
        display_name: { type: "string" },
        email: { type: "string" },
        country_code: { type: "string" },
        role: { type: "string" },
      },
      required: ["display_name", "email"],
    },
  },
  {
    name: "create_pact",
    description: "Create one authoritative Covalt Pact. This does not directly move money; funding and release remain controlled by Covalt.",
    input_schema: {
      type: "object",
      properties: {
        payer_id: { type: "string" },
        payee_id: { type: "string", description: "Authoritative Covalt recipient_ref returned by register_recipient." },
        amount_minor: { type: "integer" },
        currency: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        engagement_id: { type: "string" },
        sequence: { type: "integer" },
        blocked_until_previous_completed: { type: "boolean" },
        conditions: { type: "array" },
      },
      required: ["payer_id", "payee_id", "amount_minor", "currency", "title", "description", "engagement_id", "sequence", "blocked_until_previous_completed"],
    },
  },
  {
    name: "send_invitation",
    description: "Invite the counterparty to the first created Pact.",
    input_schema: {
      type: "object",
      properties: {
        pact_id: { type: "string" },
        email: { type: "string" },
        role: { type: "string" },
      },
      required: ["pact_id", "email"],
    },
  },
  {
    name: "submit_milestone_evidence",
    description: "Submit evidence to a Covalt milestone for authoritative verification. Never decide whether the evidence satisfies the condition.",
    input_schema: {
      type: "object",
      properties: {
        milestone_id: { type: "string" },
        evidence_url: { type: "string" },
        file_reference: { type: "string" },
        metadata: { type: "object" },
      },
      required: ["milestone_id"],
    },
  },
  {
    name: "get_trust_timeline",
    description: "Read the authoritative Covalt timeline for a Pact.",
    input_schema: {
      type: "object",
      properties: { pact_id: { type: "string" } },
      required: ["pact_id"],
    },
  },
];

const SYSTEM = `You are the Covalt Milestone Coordinator.

You are an orchestration agent, not a wallet and not a payment authority.

Rules:
- Covalt is the source of truth for recipient identity, Pact state, verification, release and settlement.
- Never invent a transaction, recipient, verification result, payment result, or evidence decision.
- Never handle card numbers, bank credentials, secrets, or private payment credentials.
- Register recipients before creating Pacts and use only the returned recipient_ref.
- Creating a Pact establishes a commitment; it does not mean money has been paid.
- Never claim a payout completed unless the Covalt timeline explicitly establishes it.
- Never decide whether evidence satisfies a condition. Submit evidence to Covalt and report the authoritative result.
- Human authorization/funding remains required where Covalt requires it.
- Prefer deterministic, explicit milestones and evidence requirements.
- If a tool returns an error, report the error; do not fabricate a successful fallback.
- Do not use simulated/demo data in production mode.`;

export interface CoordinateRequest {
  message: string;
  payer_id?: string;
  engagement_id?: string;
  recipient?: { display_name: string; email: string; country_code?: string };
  milestones?: Array<{
    title: string;
    amount_minor: number;
    currency: string;
    description?: string;
    conditions?: Array<{ id: string; description: string; evidenceSources?: string[] }>;
  }>;
}

export async function coordinate(input: CoordinateRequest) {
  const context = [
    `User request: ${input.message}`,
    input.payer_id ? `Payer ID: ${input.payer_id}` : "",
    input.engagement_id ? `Engagement ID: ${input.engagement_id}` : "",
    input.recipient ? `Recipient: ${JSON.stringify(input.recipient)}` : "",
    input.milestones ? `Structured milestones: ${JSON.stringify(input.milestones)}` : "",
  ].filter(Boolean).join("\n");

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: context }];
  let response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    system: SYSTEM,
    messages,
    tools,
  });

  const toolResults: unknown[] = [];
  while (response.stop_reason === "tool_use") {
    const calls = response.content.filter((block) => block.type === "tool_use") as Anthropic.ToolUseBlock[];
    messages.push({ role: "assistant", content: response.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of calls) {
      let result: unknown;
      try {
        switch (call.name) {
          case "register_recipient":
            result = await registerRecipient(call.input as { display_name: string; email: string; country_code?: string; role?: string });
            break;
          case "create_pact":
            result = await createPact(call.input as Record<string, unknown>);
            break;
          case "send_invitation": {
            const a = call.input as { pact_id: string; email: string; role?: string };
            result = await sendInvitation(a.pact_id, a.email, a.role);
            break;
          }
          case "submit_milestone_evidence": {
            const a = call.input as { milestone_id: string; evidence_url?: string; file_reference?: string; metadata?: Record<string, unknown> };
            result = await submitVerificationRequest(a.milestone_id, a);
            break;
          }
          case "get_trust_timeline":
            result = await getTimeline(String((call.input as { pact_id: string }).pact_id));
            break;
          default:
            result = { error: `Unknown tool: ${call.name}` };
        }
      } catch (error) {
        result = { error: error instanceof Error ? error.message : "Tool execution failed" };
      }
      toolResults.push({ tool: call.name, result });
      results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) });
    }

    messages.push({ role: "user", content: results });
    response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      system: SYSTEM,
      messages,
      tools,
    });
  }

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return { message: text, toolResults };
}
