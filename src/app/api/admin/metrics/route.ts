import { apiSession, json } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { getDb } from "@/lib/db";
import { metricsCsvRows, platformMetrics, type MetricsMode } from "@/lib/metrics";
import { isPlatformAdmin } from "@/lib/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  if (!isPlatformAdmin(r.session.user.email)) return json({ error: "Solo el personal de Compa puede ver las métricas." }, 403);
  const requested = new URL(req.url).searchParams.get("mode");
  const mode: MetricsMode = requested === "TEST" || requested === "SIMULATED" ? requested : "all";
  const csv = toCsv(metricsCsvRows(platformMetrics(getDb(), { mode })));
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="compa-metricas-${mode.toLowerCase()}.csv"`, "Cache-Control": "no-store" } });
}
