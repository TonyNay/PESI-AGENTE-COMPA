// Documentos de referencia de un análisis estratégico (plan institucional, política o marco de transformación digital).
import fs from "node:fs";
import path from "node:path";
import { all, get, run } from "./db";
import type { StrategicDocRow } from "./types";

export const docsDir = () => path.join(path.dirname(process.env.COMPA_DB_PATH || path.join(process.cwd(), "data", "compa.db")), "uploads");

export const listDocs = (strategicId: number) =>
  all<StrategicDocRow>("SELECT * FROM strategic_documents WHERE strategic_id = ? ORDER BY role, id", strategicId);

export function addDoc(strategicId: number, d: { role: StrategicDocRow["role"]; name: string; text?: string | null; pdf?: Buffer | null; url?: string | null }): number {
  const id = run("INSERT INTO strategic_documents (strategic_id, role, name, text_content, url) VALUES (?,?,?,?,?)",
    strategicId, d.role, d.name, d.text ?? null, d.url ?? null).lastInsertRowid;
  if (d.pdf) {
    fs.mkdirSync(docsDir(), { recursive: true });
    const file = path.join(docsDir(), `strategic-${strategicId}-doc-${id}.pdf`);
    fs.writeFileSync(file, d.pdf);
    run("UPDATE strategic_documents SET path = ? WHERE id = ?", file, id);
  }
  return id;
}

export function deleteDoc(strategicId: number, id: number): boolean {
  const d = get<StrategicDocRow>("SELECT * FROM strategic_documents WHERE id = ? AND strategic_id = ?", id, strategicId);
  if (!d) return false;
  run("DELETE FROM strategic_documents WHERE id = ?", id);
  if (d.path) fs.rmSync(d.path, { force: true });
  return true;
}

/** Borra los archivos de los documentos de un análisis (las filas caen por ON DELETE CASCADE). */
export function deleteDocFiles(strategicId: number) {
  for (const d of listDocs(strategicId)) if (d.path) fs.rmSync(d.path, { force: true });
}
