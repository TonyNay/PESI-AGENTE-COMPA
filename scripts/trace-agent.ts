/**
 * Traza del agente en terminal: muestra, paso a paso, lo que hace el pipeline real con un producto.
 *  - Pasos 2.x y 4.x: ejecuta las mismas funciones de la app (buildQueries, normalizeOffers, computeStats).
 *  - Pasos 3.x: ejecuta Claude Code (mismos argumentos que el proveedor claude-cli) en modo stream-json
 *    para mostrar cada búsqueda web, cada página abierta y el JSON devuelto.
 * No guarda nada en la base de datos.
 *
 * Uso: npx tsx scripts/trace-agent.ts "<nombre o id del producto>" [archivo-stream.jsonl] [--reglas]
 *   --reglas: al final, pasa por normalizeOffers casos de prueba inválidos (rotulados) para ver cada regla.
 *   --reglas-desde <stream.jsonl>: solo la verificación de reglas, con las ofertas reales de una traza
 *     guardada (no vuelve a llamar a Claude).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { get } from "../src/lib/db";
import { buildQueries, scrapingPrompt } from "../src/lib/agent/prompts";
import { OFFERS_SCHEMA } from "../src/lib/agent/schemas";
import { normalizeOffers, computeStats, type NormalizeDecision } from "../src/lib/agent/normalize";
import type { RawOffer } from "../src/lib/agent/types";
import type { Company, Product } from "../src/lib/types";

const MODEL = process.env.CLAUDE_CLI_MODEL || "claude-haiku-5-5";
const EFFORT = process.env.CLAUDE_CLI_EFFORT || "medium";
const MIN_OFFERS = 3; // mismo umbral que orchestrator.ts

/** Lo mínimo que se lee de cada línea de `claude --output-format stream-json`. */
type StreamBlock = { type: string; id?: string; name?: string; input?: Record<string, string>; tool_use_id?: string; is_error?: boolean; content?: string | { text?: string }[] };
type StreamEvent = { type: string; message?: { content?: StreamBlock[] } } & Record<string, unknown>;

const c = { dim: "\x1b[2m", b: "\x1b[1m", r: "\x1b[0m", cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", mag: "\x1b[35m", blue: "\x1b[34m" };
const t0 = Date.now();
const ts = () => `${c.dim}[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s]${c.r}`;
const step = (n: string, title: string) => console.log(`\n${c.b}${c.cyan}━━ ${n}  ${title} ${"━".repeat(Math.max(4, 64 - title.length))}${c.r}`);
const line = (s: string) => console.log(`${ts()} ${s}`);
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function runClaude(prompt: string, rawOut?: fs.WriteStream): Promise<{ offers: RawOffer[]; costUsd?: number; durationMs?: number }> {
  const args = ["-p", prompt, "--model", MODEL, "--effort", EFFORT, "--allowedTools", "WebSearch", "WebFetch",
    "--output-format", "stream-json", "--verbose", "--json-schema", JSON.stringify(OFFERS_SCHEMA)];
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "compa-trace-"));
  const pending = new Map<string, { name: string; input: Record<string, string> }>();
  const out: { result: Record<string, unknown> | null } = { result: null };
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.env.CLAUDE_CLI_BIN || "claude", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
      let buf = "";
      child.stdout.on("data", (d) => {
        buf += d;
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const raw = buf.slice(0, i); buf = buf.slice(i + 1);
          if (!raw.trim()) continue;
          rawOut?.write(raw + "\n");
          let ev: StreamEvent;
          try { ev = JSON.parse(raw); } catch { continue; }
          if (ev.type === "assistant") {
            for (const b of ev.message?.content ?? []) {
              if (b.type !== "tool_use" || !b.id || !b.name) continue;
              const input = b.input ?? {};
              pending.set(b.id, { name: b.name, input });
              if (b.name === "WebSearch") line(`${c.mag}WebSearch${c.r}  "${input.query}"`);
              else if (b.name === "WebFetch") line(`${c.blue}WebFetch ${c.r}  ${short(input.url ?? "", 96)}`);
            }
          } else if (ev.type === "user") {
            for (const b of ev.message?.content ?? []) {
              if (b.type !== "tool_result" || !b.tool_use_id) continue;
              const call = pending.get(b.tool_use_id);
              const text = typeof b.content === "string" ? b.content : (b.content ?? []).map((x) => x.text ?? "").join("\n");
              if (call?.name === "WebSearch") {
                const urls = [...new Set([...text.matchAll(/"url":"([^"]+)"/g)].map((m) => host(m[1])))];
                line(`   ${c.dim}↳ "${short(call.input.query ?? "", 34)}": ${urls.length} resultados (${short(urls.slice(0, 4).join(", "), 64)})${c.r}`);
              } else if (call?.name === "WebFetch") {
                const err = b.is_error || /\b(403|404|forbidden|error)\b/i.test(text.slice(0, 200));
                const h = host(call.input.url ?? "");
                line(`   ${err ? `${c.red}↳ ${h}: sin acceso a la página` : `${c.green}↳ ${h}: página leída (${text.length.toLocaleString("es-PE")} caracteres)`}${c.r}`);
              }
            }
          } else if (ev.type === "result") out.result = ev;
        }
      });
      child.on("error", reject);
      child.on("close", () => resolve());
    });
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
  const r = out.result;
  const data = (r?.structured_output ?? null) as { offers?: RawOffer[] } | null;
  return { offers: data?.offers ?? [], costUsd: r?.total_cost_usd as number | undefined, durationMs: r?.duration_ms as number | undefined };
}

const label: Record<NormalizeDecision, string> = {
  kept: `${c.green}✓ conservada${c.r}`, converted: `${c.green}✓ convertida${c.r}`,
  noPrice: `${c.red}✗ sin precio válido${c.r}`, lowMatch: `${c.red}✗ baja coincidencia (< 0.5)${c.r}`,
  duplicate: `${c.red}✗ duplicada${c.r}`, badCurrency: `${c.red}✗ moneda desconocida${c.r}`,
  excluded: `${c.red}✗ dominio excluido${c.r}`,
};
const show = (o: RawOffer, d: NormalizeDecision, n?: { currency: string; price: number }) =>
  line(`${short(o.competitor ?? "—", 25).padEnd(26)} ${String(o.price).padStart(9)} ${(o.currency ?? "").padEnd(4)} match ${String(o.match_score).padEnd(5)} ${label[d]}${d === "converted" && n ? `  ${o.currency} ${o.price} → ${n.currency} ${n.price}` : ""}`);

/** Pasa por normalizeOffers las ofertas reales más 4 casos de prueba rotulados, para ver cada regla. */
function rulesCheck(product: Product, raw: RawOffer[]) {
  step("4.1–4.3", "Verificación de reglas con casos de prueba");
  line(`${c.yellow}Las ${raw.length} ofertas reales + 4 casos de prueba añadidos a mano; se muestran los casos de prueba:${c.r}`);
  const base = raw[0];
  const tests: RawOffer[] = [
    { ...base }, // copia exacta de la primera oferta: debe detectarse como duplicada
    { ...base, competitor: "Tienda X [prueba]", price: 0, url: "https://example.com/sin-precio" },
    { ...base, competitor: "Accesorios Y [prueba]", product_title: "Canasta repuesto para freidora", price: 39.9, match_score: 0.3, url: "https://example.com/repuesto" },
    { ...base, competitor: "Amazon [prueba]", price: 79.9, currency: "USD", match_score: 0.9, url: "https://example.com/amazon" },
  ];
  const r2 = normalizeOffers([...raw, ...tests], product.currency, (o, d, n) => {
    if (!tests.includes(o)) return; // las reales ya se mostraron arriba
    show(o.competitor.includes("[prueba]") ? o : { ...o, competitor: `${short(o.competitor, 16)} [prueba]` }, d, n);
  });
  line(`Descartadas: ${r2.dropped.noPrice} sin precio, ${r2.dropped.lowMatch} baja coincidencia, ${r2.dropped.duplicate} duplicadas, ${r2.dropped.badCurrency} moneda desconocida · ${c.dim}(tasa referencial USD → PEN 3.75)${c.r}`);
}

async function main() {
  const arg = process.argv[2];
  const rawPath = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : undefined;
  const reglas = process.argv.includes("--reglas");
  if (!arg) { console.error('Uso: npx tsx scripts/trace-agent.ts "<nombre o id>" [stream.jsonl]'); process.exit(1); }
  const product = get<Product>("SELECT * FROM products WHERE id = ? OR name LIKE ? ORDER BY id LIMIT 1", Number(arg) || -1, `%${arg}%`);
  if (!product) { console.error("Producto no encontrado"); process.exit(1); }
  const company = get<Company>("SELECT * FROM companies WHERE id = ?", product.company_id)!;
  const desde = process.argv.indexOf("--reglas-desde");
  if (desde > 0) {
    const lines = fs.readFileSync(process.argv[desde + 1], "utf8").trim().split("\n");
    const res = lines.map((l) => JSON.parse(l) as StreamEvent).filter((e) => e.type === "result").at(-1);
    const offers = ((res?.structured_output ?? {}) as { offers?: RawOffer[] }).offers ?? [];
    console.log(`${c.b}compa · traza del agente${c.r}  ${c.dim}${offers.length} ofertas reales de ${path.basename(process.argv[desde + 1])}${c.r}`);
    rulesCheck(product, offers);
    return;
  }
  const rawOut = rawPath ? fs.createWriteStream(rawPath) : undefined;

  console.log(`${c.b}compa · traza del agente${c.r}  ${c.dim}modelo ${MODEL} · esfuerzo ${EFFORT}${c.r}`);

  step("2.1", "Leer los datos del producto y de la empresa");
  line(`Producto  ${c.b}${product.name}${c.r} (#${product.id}, ${product.type})`);
  line(`          marca ${product.brand ?? "—"} · categoría ${product.category ?? "—"} · SKU ${product.sku ?? "—"}`);
  line(`          precio ${product.currency} ${product.price} · palabras clave: ${product.keywords ?? "—"}`);
  line(`Empresa   ${c.b}${company.name}${c.r} · ${company.industry ?? "—"}`);

  step("2.2", "Identificar el país y la moneda de referencia");
  line(`País de referencia: ${c.b}${company.country}${c.r}   Moneda del producto: ${c.b}${product.currency}${c.r}`);

  step("2.3", "Generar hasta cinco consultas de búsqueda");
  const queries = buildQueries(product, company);
  queries.forEach((q, i) => line(`${c.yellow}${i + 1}.${c.r} ${q}`));

  step("3.1–3.2", "Buscar en la web y abrir páginas de tiendas (Claude Code)");
  line(`${c.dim}claude -p <prompt> --model ${MODEL} --effort ${EFFORT} --allowedTools WebSearch WebFetch --json-schema <OFFERS_SCHEMA>${c.r}`);
  let res = await runClaude(scrapingPrompt(product, company, queries), rawOut);

  step("3.3–3.4", "Extraer campos y asignar grado de coincidencia");
  const printOffers = (offers: RawOffer[]) => {
    console.log(`${c.dim}         ${"TIENDA".padEnd(26)}${"PRECIO".padStart(10)}  MON  ${"MATCH".padStart(5)}  DISPONIB.        FUENTE${c.r}`);
    for (const o of offers)
      line(`${short(o.competitor ?? "—", 25).padEnd(26)}${String(o.price).padStart(10)}  ${(o.currency ?? "").padEnd(4)} ${String(o.match_score).padStart(5)}  ${short(o.availability ?? "—", 15).padEnd(16)} ${host(o.url ?? "")}`);
  };
  printOffers(res.offers);
  line(`${c.green}${res.offers.length} ofertas candidatas${c.r}${res.durationMs ? ` en ${(res.durationMs / 1000).toFixed(1)}s` : ""}${res.costUsd != null ? ` · costo ≈ US$ ${res.costUsd.toFixed(4)}` : ""}`);

  step("3.5", "Ampliar la búsqueda si hay menos de tres ofertas");
  let raw = res.offers;
  if (raw.length < MIN_OFFERS) {
    line(`${c.yellow}Solo ${raw.length} ofertas (< ${MIN_OFFERS}): búsqueda ampliada en otras tiendas…${c.r}`);
    res = await runClaude(scrapingPrompt(product, company, queries, raw.map((o) => o.competitor)), rawOut);
    printOffers(res.offers);
    raw = raw.concat(res.offers);
  } else line(`${raw.length} ofertas ≥ ${MIN_OFFERS}: ${c.green}no se requiere búsqueda ampliada${c.r}`);

  step("4.1–4.3", "Descartar, deduplicar y convertir moneda");
  const { kept, dropped } = normalizeOffers(raw, product.currency, show);
  line(`Descartadas: ${dropped.noPrice} sin precio, ${dropped.lowMatch} baja coincidencia, ${dropped.duplicate} duplicadas, ${dropped.badCurrency} moneda desconocida → ${c.b}${c.green}${kept.length} conservadas${c.r}`);

  step("4.4", "Calcular estadísticas, índice de precio y posición");
  const s = computeStats(product.price, product.currency, kept.map((o) => o.price));
  if (!s) { line(`${c.red}Sin ofertas comparables: el análisis fallaría aquí.${c.r}`); }
  else {
    const pos = { cheaper: "Más barato", market: "En mercado", expensive: "Más caro" }[s.position];
    line(`mín ${s.min} · máx ${s.max} · promedio ${s.avg} · mediana ${s.median}   (${s.currency})`);
    line(`índice de precio = ${product.price} ÷ ${s.avg} × 100 = ${c.b}${s.priceIndex}${c.r}   percentil ${s.percentile}%`);
    line(`posición: ${c.b}${pos}${c.r}  ${c.dim}(≤ 95 más barato · 95–105 en mercado · > 105 más caro)${c.r}`);
  }
  if (reglas && raw.length) rulesCheck(product, raw);
  console.log(`\n${c.dim}Siguiente paso (5.x): análisis estratégico con las ${kept.length} ofertas conservadas.${c.r}`);
  rawOut?.end();
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
