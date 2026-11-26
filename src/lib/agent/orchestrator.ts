import { all, get, getDb, run } from "../db";
import type { AnalysisResult, AnalysisRow, Company, Product, Strategy } from "../types";
import { ANOMALY_REASON, normalizeOffers, computeStats, splitAnomalies } from "./normalize";
import { buildQueries, scrapingPrompt, strategyPrompt } from "./prompts";
import { getProvider } from "./providers";
import { OFFERS_SCHEMA, STRATEGY_SCHEMA } from "./schemas";
import type { RawOffer } from "./types";

/** Por debajo de este número de ofertas candidatas, el agente hace una segunda búsqueda ampliada. */
const MIN_OFFERS = 3;

export type LogFn = (step: string, message: string, level?: "info" | "warn" | "error" | "success") => void;

export function logStep(analysisId: number, step: string, message: string, level = "info") {
  run("INSERT INTO agent_logs (analysis_id, step, level, message) VALUES (?,?,?,?)", analysisId, step, level, message);
}

export function createAnalysis(productId: number, companyId: number, provider?: string): number {
  const name = provider || process.env.AGENT_PROVIDER || "claude-cli";
  return run(
    "INSERT INTO analyses (product_id, company_id, status, provider) VALUES (?,?, 'queued', ?)",
    productId, companyId, name
  ).lastInsertRowid;
}

export async function runAnalysis(analysisId: number): Promise<void> {
  const a = get<AnalysisRow>("SELECT * FROM analyses WHERE id = ?", analysisId);
  if (!a) throw new Error(`Análisis ${analysisId} no existe`);
  const log: LogFn = (step, msg, level = "info") => logStep(analysisId, step, msg, level);
  const t0 = Date.now();
  try {
    run("UPDATE analyses SET status='running', started_at=datetime('now'), error=NULL WHERE id = ?", analysisId);
    const product = get<Product>("SELECT * FROM products WHERE id = ? AND company_id = ?", a.product_id, a.company_id);
    const company = get<Company>("SELECT * FROM companies WHERE id = ?", a.company_id);
    if (!product || !company) throw new Error("Producto o empresa no encontrados");
    const provider = getProvider(a.provider || undefined);
    let cost = 0, llmMs = 0;

    // 1. Planificación
    log("planificacion", `Iniciando análisis de "${product.name}" con el proveedor ${provider.name}.`);
    const queries = buildQueries(product, company);
    log("planificacion", `Consultas de búsqueda planificadas (${queries.length}):\n- ${queries.join("\n- ")}`, "success");

    // 2. Búsqueda y scraping
    log("busqueda", "El agente buscará en la web y visitará tiendas de la competencia para extraer ofertas…");
    let raw: RawOffer[] = [];
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await provider.runStructured<{ offers: RawOffer[] }>({
          prompt: scrapingPrompt(product, company, queries),
          schema: OFFERS_SCHEMA,
          useWebTools: true,
          label: "scraping",
          onProgress: (m) => log("busqueda", m),
        });
        raw = Array.isArray(res.data?.offers) ? res.data.offers : [];
        cost += res.costUsd || 0; llmMs += res.durationMs || 0;
        if (res.costUsd != null || res.durationMs != null)
          log("busqueda", `Búsqueda finalizada: ${raw.length} ofertas candidatas${res.durationMs ? ` en ${(res.durationMs / 1000).toFixed(1)}s` : ""}${res.costUsd != null ? ` (costo ≈ US$ ${res.costUsd.toFixed(4)})` : ""}.`, "success");
        else log("busqueda", `Búsqueda finalizada: ${raw.length} ofertas candidatas.`, "success");
        lastErr = undefined;
        break;
      } catch (e) {
        lastErr = e;
        log("busqueda", `Intento ${attempt} falló: ${(e as Error).message}`, "warn");
      }
    }
    if (lastErr) throw lastErr;

    // 2b. Búsqueda ampliada: si hubo pocas ofertas, una segunda pasada con otras tiendas
    if (raw.length < MIN_OFFERS) {
      const known = raw.map((o) => o.competitor).filter(Boolean);
      log("busqueda", `Solo ${raw.length} ofertas candidatas; el agente amplía la búsqueda a otras tiendas…`, "warn");
      try {
        const res = await provider.runStructured<{ offers: RawOffer[] }>({
          prompt: scrapingPrompt(product, company, queries, known),
          schema: OFFERS_SCHEMA,
          useWebTools: true,
          label: "scraping-ampliado",
          onProgress: (m) => log("busqueda", m),
        });
        const extra = Array.isArray(res.data?.offers) ? res.data.offers : [];
        raw = raw.concat(extra);
        cost += res.costUsd || 0; llmMs += res.durationMs || 0;
        log("busqueda", `Búsqueda ampliada: +${extra.length} ofertas candidatas (total ${raw.length}).`, "success");
      } catch (e) {
        log("busqueda", `La búsqueda ampliada falló: ${(e as Error).message}`, "warn");
      }
    }

    // 3. Normalización
    log("normalizacion", `Normalizando ${raw.length} ofertas (filtrar sin precio / match < 0.5, deduplicar por URL, convertir monedas)…`);
    const { kept, dropped } = normalizeOffers(raw, product.currency);
    log("normalizacion", `Descartadas: ${dropped.noPrice} sin precio válido, ${dropped.lowMatch} con baja coincidencia, ${dropped.duplicate} duplicadas, ${dropped.badCurrency} con moneda desconocida. Conservadas: ${kept.length}.`);
    if (!kept.length) throw new Error("No se encontraron ofertas comparables con precio verificable. Intenta de nuevo o ajusta el nombre/marca del producto.");
    const { clean, flagged } = splitAnomalies(kept);
    if (flagged.length) log("normalizacion", `${flagged.length} oferta(s) con precio inusualmente bajo quedan fuera de las estadísticas: ${flagged.map((o) => `${o.competitor} (${o.currency} ${o.price})`).join(", ")}.`, "warn");
    if (dropped.excluded) log("normalizacion", `${dropped.excluded} oferta(s) omitidas por pertenecer a dominios excluidos.`, "warn");
    const stats = computeStats(product.price, product.currency, clean.map((o) => o.price))!;
    log("normalizacion", `Estadísticas: mín ${stats.min}, máx ${stats.max}, promedio ${stats.avg}, mediana ${stats.median}; índice de precio ${stats.priceIndex}; posición: ${stats.position}.`, "success");

    // 4. Análisis estratégico
    log("analisis", "Generando análisis estratégico (resumen, FODA, recomendaciones, precio sugerido)…");
    const sres = await provider.runStructured<Strategy>({
      prompt: strategyPrompt(product, company, stats, clean),
      schema: STRATEGY_SCHEMA,
      useWebTools: false,
      label: "strategy",
      onProgress: (m) => log("analisis", m),
    });
    const strategy = sres.data;
    cost += sres.costUsd || 0; llmMs += sres.durationMs || 0;
    if (!strategy || typeof strategy.resumen_ejecutivo !== "string") throw new Error("El análisis estratégico devolvió un formato inválido.");
    strategy.precio_sugerido = Number(strategy.precio_sugerido) > 0 ? Number(strategy.precio_sugerido) : product.price;
    log("analisis", `Análisis estratégico listo. Precio sugerido: ${product.currency} ${strategy.precio_sugerido}.`, "success");

    // 5. Guardar
    log("guardado", "Guardando ofertas y reporte…");
    const db = getDb();
    db.exec("BEGIN");
    try {
      run("DELETE FROM competitor_offers WHERE analysis_id = ?", analysisId);
      for (const o of kept) {
        run(
          `INSERT INTO competitor_offers (analysis_id, competitor, product_title, price, currency, url, rating, availability, features, match_score, anomaly)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          analysisId, o.competitor, o.product_title, o.price, o.currency, o.url,
          typeof o.rating === "number" && o.rating > 0 ? o.rating : null,
          o.availability || null,
          [o.features, o.originalCurrency ? `(precio original ${o.originalCurrency} ${o.originalPrice})` : ""].filter(Boolean).join(" "),
          o.match_score,
          flagged.includes(o) ? ANOMALY_REASON : null
        );
      }
      const result: AnalysisResult = {
        stats, strategy, queries, rawOffers: raw.length, keptOffers: kept.length, anomalies: flagged.length,
        meta: { costUsd: cost || undefined, durationMs: llmMs || Date.now() - t0, provider: provider.name },
      };
      run("UPDATE analyses SET status='completed', finished_at=datetime('now'), result_json=? WHERE id = ?", JSON.stringify(result), analysisId);
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
    log("guardado", `Análisis completado en ${((Date.now() - t0) / 1000).toFixed(1)}s.`, "success");
  } catch (e) {
    const msg = (e as Error).message || String(e);
    logStep(analysisId, "error", msg, "error");
    run("UPDATE analyses SET status='failed', finished_at=datetime('now'), error=? WHERE id = ?", msg, analysisId);
  }
}

export function getOffers(analysisId: number) {
  return all("SELECT * FROM competitor_offers WHERE analysis_id = ? ORDER BY price ASC", analysisId);
}
