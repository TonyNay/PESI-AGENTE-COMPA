import { apiSession, json } from "@/lib/api";
import { createAnalysis } from "@/lib/agent/orchestrator";
import { enqueueAnalysis } from "@/lib/agent/queue";
import { getProduct } from "@/lib/products";
import { get } from "@/lib/db";
import { planLimitError } from "@/lib/billing/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  const b = await req.json().catch(() => ({}));
  const product = getProduct(r.session.company.id, Number(b.productId));
  if (!product) return json({ error: "Producto no encontrado" }, 404);
  const active = get<{ id: number }>("SELECT id FROM analyses WHERE product_id = ? AND status IN ('queued','running')", product.id);
  if (active) return json({ id: active.id, reused: true });
  const limit = planLimitError(r.session.company.id, "priceAnalyses");
  if (limit) return json({ error: limit }, 402);
  const provider = ["mock", "claude-cli", "anthropic"].includes(b.provider) && process.env.COMPA_ALLOW_PROVIDER_OVERRIDE === "1" ? b.provider : undefined;
  const id = createAnalysis(product.id, r.session.company.id, provider);
  enqueueAnalysis(id);
  return json({ id }, 201);
}
