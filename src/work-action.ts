import { createMilestone, createPact, registerRecipient, sendInvitation } from "./covalt.js";

export interface WorkMilestone { key: string; title: string; amount_minor: number; currency: string; description?: string; conditions?: Array<{ id: string; description: string; evidenceSources?: string[] }>; }

export async function createWorkEngagement(input: { payer_id: string; engagement_id: string; client_email: string; recipient: { display_name: string; email: string; country_code?: string }; project_description: string; milestones: WorkMilestone[] }) {
  if (!input.milestones.length) throw new Error("At least one milestone is required.");
  const recipient = await registerRecipient({ display_name: input.recipient.display_name, email: input.recipient.email, country_code: input.recipient.country_code, role: "COMMERCIAL_SELLER" });
  const pacts = [];
  for (let index = 0; index < input.milestones.length; index += 1) {
    const milestone = input.milestones[index]!;
    const createdMilestone = await createMilestone({ name: milestone.title, description: milestone.description ?? input.project_description, conditions: milestone.conditions ?? [] });
    const pact = await createPact({ title: milestone.title, amount: milestone.amount_minor, currency: milestone.currency, payer_id: input.payer_id, payee_id: recipient.recipient_ref, customer_email: input.client_email, description: input.project_description, engagement_id: input.engagement_id, sequence: index + 1, blocked_until_previous_completed: index > 0, milestone_ids: [String(createdMilestone.id)], metadata: { vertical: "work", milestone: milestone.key, covalt_milestone_id: String(createdMilestone.id) } });
    pacts.push(pact);
  }
  const invitation = await sendInvitation(pacts[0].id, input.recipient.email, "PROVIDER");
  return { engagement_id: input.engagement_id, recipient, pacts, invitation };
}
