import fs from "node:fs";
import path from "node:path";
import type { AnalysisResult } from "./types";

export interface SampleOffer { competitor: string; product_title: string | null; price: number; currency: string; url: string | null; availability: string | null; match_score: number | null }
export interface SampleReport { productName: string; finishedAt: string; result: AnalysisResult; offers: SampleOffer[] }

/**
 * Reporte real del agente (exportado en data/seed-analyses.json) que se muestra en la página pública
 * /ejemplo, para que un visitante vea el resultado antes de crear una cuenta.
 */
export function sampleReport(): SampleReport | null {
  try {
    const file = path.join(process.cwd(), "data", "seed-analyses.json");
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as { analyses: (SampleReport & { finished_at: string })[] };
    const usable = data.analyses.filter((a) => a.result?.stats && a.result?.strategy && a.offers?.length);
    // El análisis con más ofertas comparables es el más representativo.
    const best = usable.sort((a, b) => b.offers.length - a.offers.length)[0];
    return best ? { productName: best.productName, finishedAt: best.finished_at, result: best.result, offers: best.offers } : null;
  } catch { return null; }
}
