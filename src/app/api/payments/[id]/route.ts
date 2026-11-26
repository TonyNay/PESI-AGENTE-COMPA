import { paymentRequest } from "@/lib/billing/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, context: Context) {
  const { id } = await context.params;
  return paymentRequest(req, {}, (service, actor) => service.status(actor, id));
}
export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  return paymentRequest(req, { write: true, limit: "checkout" }, (service, actor) => service.resume(actor, id));
}
