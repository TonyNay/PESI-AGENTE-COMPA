import fs from "node:fs";
import path from "node:path";
import { all, get } from "../src/lib/db";

const company = get<{ id: number }>("SELECT c.id FROM companies c JOIN users u ON u.company_id=c.id WHERE u.email='demo@compa.pe'");
if (!company) { console.error("No existe la empresa demo."); process.exit(1); }
const rows = all<{ id: number; product_name: string; provider: string; started_at: string; finished_at: string; result_json: string }>(
  `SELECT a.id, p.name product_name, a.provider, a.started_at, a.finished_at, a.result_json
   FROM analyses a JOIN products p ON p.id=a.product_id WHERE a.company_id=? AND a.status='completed' ORDER BY a.id`, company.id);
const analyses = rows.map((a) => ({
  productName: a.product_name, provider: a.provider, started_at: a.started_at, finished_at: a.finished_at,
  result: JSON.parse(a.result_json),
  offers: all("SELECT competitor, product_title, price, currency, url, rating, availability, features, match_score, scraped_at FROM competitor_offers WHERE analysis_id=? ORDER BY id", a.id),
  logs: all("SELECT ts, step, level, message FROM agent_logs WHERE analysis_id=? ORDER BY id", a.id),
}));
const out = path.join(process.cwd(), "data", "seed-analyses.json");
fs.writeFileSync(out, JSON.stringify({ exportedAt: new Date().toISOString(), analyses }, null, 2));
console.log(`Exportados ${analyses.length} análisis a ${out}`);
