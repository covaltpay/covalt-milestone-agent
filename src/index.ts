import Anthropic from "@anthropic-ai/sdk";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { MILESTONE_COORDINATOR_SYSTEM_PROMPT } from "./prompts.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const COVALT_API_KEY = process.env.COVALT_API_KEY;
const COVALT_BASE_URL = process.env.COVALT_BASE_URL || "https://api.covaltpay.com/v1";

if (!ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY environment variable is required.");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// MCP tool definition matching the Covalt Agent Gateway
const tools: Anthropic.Tool[] = [
  {
    name: "propose_pact",
    description:
      "Create a DRAFT Pact with milestones, intent hash, and human authorization link. Never moves money directly.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short descriptive name for the deliverable or engagement" },
        description: { type: "string", description: "Clear scope of work and conditions" },
        target_amount_minor: {
          type: "integer",
          description: "Total commitment value in minor currency units (e.g. 300000 for £3,000.00)",
        },
        currency: { type: "string", description: "ISO currency code (e.g. GBP, EUR, USD)" },
        category: { type: "string", enum: ["BUSINESS", "FAMILY_FRIEND"], description: "Pact category" },
        required_participants: { type: "integer", description: "Number of authorized parties" },
        deadline: { type: "string", description: "ISO 8601 deadline date" },
      },
      required: ["title", "target_amount_minor", "currency", "category"],
    },
  },
  {
    name: "get_trust_timeline",
    description: "Fetch the chronological, verified state and audit trail for an existing Pact.",
    input_schema: {
      type: "object",
      properties: {
        pact_id: { type: "string", description: "UUID or human-readable short ID of the Pact" },
      },
      required: ["pact_id"],
    },
  },
];

async function handleToolCall(name: string, args: any) {
  if (name === "propose_pact") {
    // If COVALT_API_KEY is configured, call the live API; otherwise simulate the gateway response
    if (COVALT_API_KEY) {
      try {
        const res = await fetch(`${COVALT_BASE_URL}/pacts/propose`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${COVALT_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(args),
        });
        return await res.json();
      } catch (err: any) {
        return { error: `Failed to call Covalt API: ${err.message}` };
      }
    }

    // Reference simulation matching canonical Covalt Agent Gateway behavior
    const shortId = `P${Math.floor(10000 + Math.random() * 90000)}`;
    const fee = Math.max(Math.round(args.target_amount_minor * 0.035), 250);
    return {
      status: "DRAFT_CREATED",
      pact_short_id: shortId,
      currency: args.currency || "GBP",
      total_amount_minor: args.target_amount_minor,
      platform_fee_minor: fee,
      intent_hash: "sha256_" + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      approval_link: `https://covaltpay.com/pact/${shortId}?approve=sample_token_${Date.now()}`,
      note: "Human authorization required. Funds remain on payment rail until milestone conditions clear.",
    };
  }

  return { error: `Tool ${name} not implemented` };
}

async function run() {
  console.log("\n=======================================================");
  console.log("  Covalt Autonomous Milestone Coordinator (CLI)");
  console.log("  Enforcing the Agent Execution Wall");
  console.log("=======================================================\n");

  const rl = readline.createInterface({ input, output });
  const messages: Anthropic.MessageParam[] = [];

  while (true) {
    const userPrompt = await rl.question("\nYou > ");
    if (!userPrompt.trim() || userPrompt.toLowerCase() === "exit") break;

    messages.push({ role: "user", content: userPrompt });

    let response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      system: MILESTONE_COORDINATOR_SYSTEM_PROMPT,
      messages,
      tools,
    });

    while (response.stop_reason === "tool_use") {
      const toolUse = response.content.find((block) => block.type === "tool_use") as Anthropic.ToolUseBlock;
      if (!toolUse) break;

      console.log(`\n[Agent executing tool: ${toolUse.name}]...`);
      const toolResult = await handleToolCall(toolUse.name, toolUse.input);

      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult),
          },
        ],
      });

      response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        system: MILESTONE_COORDINATOR_SYSTEM_PROMPT,
        messages,
        tools,
      });
    }

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n");

    console.log(`\nCoordinator > ${reply}`);
    messages.push({ role: "assistant", content: response.content });
  }

  rl.close();
}

run().catch(console.error);
