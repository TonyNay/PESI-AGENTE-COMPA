import { apiSession, json } from "@/lib/api";
import { assertPaymentOrigin } from "@/lib/billing/http";
import { PaymentError } from "@/lib/billing/config";
import { run } from "@/lib/db";

export const runtime = "nodejs";

const TABLES = { analysis: "analyses", strategic: "strategic_analyses" } as const;

/** Registra quién revisó el reporte generado por IA. Es un acto humano explícito, por empresa. */
export async function POST(req: Request) {
  try {
    assertPaymentOrigin(req);
  } catch (error) {
    return json({ error: (error as PaymentError).message }, 403);
  }
  const r = await apiSession();
  if ("error" in r) return r.error;
  const b = await req.json().catch(() => ({}));
  const table = TABLES[b.kind as keyof typeof TABLES];
  if (!table) return json({ error: "Tipo de reporte inválido" }, 400);
  const { changes } = run(`UPDATE ${table} SET reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? AND company_id = ? AND status = 'completed'`, r.session.user.name, Number(b.id), r.session.company.id);
  if (!changes) return json({ error: "Reporte no encontrado o aún sin terminar" }, 404);
  return json({ ok: true });
}
