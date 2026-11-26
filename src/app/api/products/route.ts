import { all } from "@/lib/db";
import { apiSession, json } from "@/lib/api";
import { cleanProduct, insertProduct } from "@/lib/products";
import { planLimitError } from "@/lib/billing/server";

export const runtime = "nodejs";

export async function GET() {
  const r = await apiSession();
  if ("error" in r) return r.error;
  return json(all("SELECT * FROM products WHERE company_id = ? ORDER BY created_at DESC, id DESC", r.session.company.id));
}

export async function POST(req: Request) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  const limit = planLimitError(r.session.company.id, "products");
  if (limit) return json({ error: limit }, 402);
  try {
    const id = insertProduct(r.session.company.id, cleanProduct(await req.json(), r.session.company.currency));
    return json({ id }, 201);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
