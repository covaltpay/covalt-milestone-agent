const COVALT_API_KEY = process.env.COVALT_API_KEY;
const COVALT_BASE_URL = (process.env.COVALT_BASE_URL || "https://api.covaltpay.com/v1").replace(/\/$/, "");

if (!COVALT_API_KEY) throw new Error("COVALT_API_KEY environment variable is required.");

export class CovaltAgentError extends Error {
  constructor(public readonly status: number, message: string, public readonly details?: unknown) {
    super(message);
    this.name = "CovaltAgentError";
  }
}

export async function covaltRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${COVALT_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": COVALT_API_KEY!,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }

  if (!response.ok) {
    const message =
      typeof body === "object" && body && "message" in body
        ? String((body as { message?: unknown }).message)
        : `Covalt API returned HTTP ${response.status}`;
    throw new CovaltAgentError(response.status, message, body);
  }

  return body as T;
}

export interface Recipient {
  recipient_ref: string;
  display_name: string;
  email: string;
  country_code?: string | null;
  role?: string;
  verification_status?: string;
  payout_eligible?: boolean;
}

export async function registerRecipient(input: {
  display_name: string;
  email: string;
  country_code?: string;
  role?: string;
}): Promise<Recipient> {
  return covaltRequest<Recipient>("/recipients", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface Pact {
  id: string;
  reference?: string;
  status?: string;
  title?: string;
  amount?: number;
  amount_minor?: number;
  currency?: string;
  payer_id?: string;
  payee_id?: string;
  engagement_id?: string;
  sequence?: number;
  payment?: unknown;
  payment_url?: string;
  conditions?: unknown[];
  [key: string]: unknown;
}

export async function createPact(input: Record<string, unknown>): Promise<Pact> {
  return covaltRequest<Pact>("/pacts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function sendInvitation(pactId: string, email: string, role = "PROVIDER") {
  return covaltRequest<Record<string, unknown>>(`/pacts/${encodeURIComponent(pactId)}/invites`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export async function getTimeline(pactId: string) {
  return covaltRequest<Record<string, unknown>>(`/pacts/${encodeURIComponent(pactId)}/timeline`);
}

export async function submitVerificationRequest(
  milestoneId: string,
  input: { evidence_url?: string; file_reference?: string; metadata?: Record<string, unknown> },
) {
  return covaltRequest<Record<string, unknown>>(
    `/milestones/${encodeURIComponent(milestoneId)}/verification-request`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
