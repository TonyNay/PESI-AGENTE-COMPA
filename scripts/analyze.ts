import { all, get } from "../src/lib/db";
import { createAnalysis, runAnalysis } from "../src/lib/agent/orchestrator";

async function main() {
  const arg = process.argv[2];
  if (!arg) { console.error("Uso: npm run analyze -- <productId|all>"); process.exit(1); }
  const company = get<{ id: number }>("SELECT c.id FROM companies c JOIN users u ON u.company_id=c.id WHERE u.email='demo@compa.pe'");
  if (!company) { console.error("No existe la empresa demo. Ejecuta: npm run seed"); process.exit(1); }
  const products = arg === "all"
    ? all<{ id: number; name: string }>("SELECT id, name FROM products WHERE company_id = ? ORDER BY id", company.id)
    : all<{ id: number; name: string }>("SELECT id, name FROM products WHERE company_id = ? AND id = ?", company.id, Number(arg));
  if (!products.length) { console.error("No se encontraron productos."); process.exit(1); }
  console.log(`Proveedor: ${process.env.AGENT_PROVIDER || "claude-cli"} | Productos: ${products.length}`);

  for (const p of products) {
    console.log(`\n=== ${p.name} (#${p.id}) ===`);
    const id = createAnalysis(p.id, company.id);
    let last = 0;
    const timer = setInterval(() => {
      for (const l of all<{ id: number; ts: string; step: string; level: string; message: string }>("SELECT * FROM agent_logs WHERE analysis_id=? AND id>? ORDER BY id", id, last)) {
        last = l.id;
        console.log(`  [${l.step}] ${l.level === "error" ? "ERROR " : ""}${l.message.replace(/\n/g, "\n      ")}`);
      }
    }, 1000);
    await runAnalysis(id);
    await new Promise((r) => setTimeout(r, 1100));
    clearInterval(timer);
    const a = get<{ status: string; error: string | null }>("SELECT status, error FROM analyses WHERE id=?", id)!;
    const n = get<{ n: number }>("SELECT COUNT(*) n FROM competitor_offers WHERE analysis_id=?", id)!.n;
    console.log(`-> análisis #${id}: ${a.status}${a.error ? " (" + a.error + ")" : ""}, ofertas guardadas: ${n}`);
  }
}
main().then(() => process.exit(0));
