import { apiSession, json } from "@/lib/api";
import { audit } from "@/lib/audit";
import { FORMAT_LABEL, mapCatalog } from "@/lib/catalog-import";
import { parseCsv } from "@/lib/csv";
import { get } from "@/lib/db";
import { clientIp } from "@/lib/platform";
import { cleanProduct, insertProduct, updateProduct } from "@/lib/products";
import { planLimitError } from "@/lib/billing/server";

export const runtime = "nodejs";

/**
 * Importa la plantilla de Compa o una exportación de Shopify o WooCommerce. Si un SKU ya existe en el
 * catálogo, se actualiza ese producto (sirve para sincronizar precios) en lugar de duplicarlo.
 */
export async function POST(req: Request) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  const { company, user } = r.session;
  const { csv } = await req.json().catch(() => ({ csv: "" }));
  const rows = parseCsv(String(csv || ""));
  if (rows.length < 2) return json({ error: "El CSV está vacío o no tiene filas de datos." }, 400);
  const mapped = mapCatalog(rows);
  if (!mapped) return json({ error: "No reconocimos el formato. Usa la plantilla de Compa (columnas 'nombre' y 'precio') o la exportación de productos de Shopify o WooCommerce." }, 400);
  const errors: string[] = [];
  const prepared: { line: number; product: ReturnType<typeof cleanProduct>; existing: number | null }[] = [];
  for (const { line, product } of mapped.rows) {
    try {
      const clean = cleanProduct(product, company.currency);
      const existing = clean.sku ? get<{ id: number }>("SELECT id FROM products WHERE company_id = ? AND sku = ?", company.id, clean.sku)?.id ?? null : null;
      prepared.push({ line, product: clean, existing });
    } catch (e) { errors.push(`Fila ${line}: ${(e as Error).message}`); }
  }
  const limit = planLimitError(company.id, "products", prepared.filter((p) => p.existing === null).length);
  if (limit) return json({ error: limit }, 402);
  let imported = 0, updated = 0;
  for (const p of prepared) {
    try {
      if (p.existing !== null) { updateProduct(company.id, p.existing, p.product); updated++; }
      else { insertProduct(company.id, p.product); imported++; }
    } catch (e) { errors.push(`Fila ${p.line}: ${(e as Error).message}`); }
  }
  audit({ action: "catalog.import", companyId: company.id, userId: user.id, detail: `${FORMAT_LABEL[mapped.format]}: ${imported} nuevos, ${updated} actualizados`, ip: clientIp(req) });
  return json({ format: mapped.format, formatLabel: FORMAT_LABEL[mapped.format], imported, updated, errors, skipped: mapped.skipped.slice(0, 20) });
}
