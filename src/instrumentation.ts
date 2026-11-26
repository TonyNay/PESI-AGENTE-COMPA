export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { failOrphanAnalyses } = await import("./lib/db");
    const n = failOrphanAnalyses();
    if (n > 0) console.log(`[compa] ${n} análisis huérfanos marcados como fallidos`);
  }
}
