import { paymentRequest } from "@/lib/billing/server";

export const runtime = "nodejs";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return paymentRequest(req, { write: true, limit: "charge" }, (service, actor, body) => service.simulate(actor, id, body));
}
