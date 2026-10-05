import { createServer } from "node:http";
import { coordinate, type CoordinateRequest } from "./coordinator.js";
import { createWorkEngagement } from "./work-action.js";

const PORT = Number(process.env.PORT || 8787);
const AGENT_SHARED_SECRET = process.env.AGENT_SHARED_SECRET;

if (!AGENT_SHARED_SECRET) throw new Error("AGENT_SHARED_SECRET environment variable is required.");

function send(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { ok: true, service: "covalt-milestone-agent" });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return send(res, 404, { error: "Not found" });
  }

  if (req.method === "POST" && req.url !== "/v1/coordinate" && req.url !== "/v1/work/engagements") {
    return send(res, 404, { error: "Not found" });
  }

  if (req.method === "GET" && req.url !== "/health") {
    return send(res, 404, { error: "Not found" });
  }

  if (req.headers.authorization !== `Bearer ${AGENT_SHARED_SECRET}`) {
    return send(res, 401, { error: "Unauthorized" });
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as CoordinateRequest;

    if (!body.message || typeof body.message !== "string") {
      return send(res, 400, { error: "message is required" });
    }

    if (req.url === "/v1/work/engagements") {
      const result = await createWorkEngagement(body as Parameters<typeof createWorkEngagement>[0]);
      return send(res, 200, result);
    }

    const result = await coordinate(body as CoordinateRequest);
    return send(res, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent request failed";
    return send(res, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Covalt Milestone Agent listening on :${PORT}`);
});
