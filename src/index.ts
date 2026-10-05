import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { coordinate } from "./coordinator.js";

async function run() {
  console.log("\nCovalt Autonomous Milestone Coordinator");
  console.log("Execution Wall active. Type 'exit' to quit.\n");

  const rl = readline.createInterface({ input, output });

  while (true) {
    const userPrompt = await rl.question("\nYou > ");
    if (!userPrompt.trim() || userPrompt.toLowerCase() === "exit") break;

    try {
      const result = await coordinate({ message: userPrompt });
      console.log(`\nCoordinator > ${result.message}`);
    } catch (error) {
      console.error("\nCoordinator error:", error);
    }
  }

  rl.close();
}

run().catch(console.error);
