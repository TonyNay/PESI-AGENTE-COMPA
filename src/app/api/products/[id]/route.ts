import { run } from "@/lib/db";
import { apiSession, json } from "@/lib/api";
import { cleanProduct, getProduct, updateProduct } from "@/lib/products";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  const p = getProduct(r.session.company.id, Number((await params).id));
  return p ? json(p) : json({ error: "No encontrado" }, 404);
}

export async function PUT(req: Request, { params }: Ctx) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  const id = Number((await params).id);
  try {
    const n = updateProduct(r.session.company.id, id, cleanProduct(await req.json(), r.session.company.currency));
    return n ? json({ ok: true }) : json({ error: "No encontrado" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}

export async function DELETE(_: Request, { params }: Ctx) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  const n = run("DELETE FROM products WHERE id = ? AND company_id = ?", Number((await params).id), r.session.company.id).changes;
  return n ? json({ ok: true }) : json({ error: "No encontrado" }, 404);
}
