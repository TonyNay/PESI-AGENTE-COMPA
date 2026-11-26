import { paymentRequest } from "@/lib/billing/server";

export const runtime = "nodejs";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return paymentRequest(req, { write: true, limit: "checkout" }, (service, actor, body) => service.refund(actor, id, body));
}
