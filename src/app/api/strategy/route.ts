import { apiSession, json } from "@/lib/api";
import { attachPdf, createStrategic, type StrategicInput } from "@/lib/agent/strategic";
import { enqueueStrategic } from "@/lib/agent/queue";
import { get, run } from "@/lib/db";
import { normalizeModules } from "@/lib/strategy-modules";
import { planLimitError } from "@/lib/billing/server";
import { redactPersonalData } from "@/lib/privacy";
import { addDoc } from "@/lib/td-docs";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
/** Tope de texto del documento que va al prompt (el CLI recibe el prompt como argumento). */
const MAX_DOC_CHARS = 30000;
const TEXT_EXT = /\.(txt|md|markdown|csv|json|html?)$/i;

const field = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);

export async function POST(req: Request) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  const { company } = r.session;
  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "Formulario inválido" }, 400);

  const active = get<{ id: number }>("SELECT id FROM strategic_analyses WHERE company_id = ? AND status IN ('queued','running')", company.id);
  if (active) return json({ id: active.id, reused: true });
  const limit = planLimitError(company.id, "strategicAnalyses");
  if (limit) return json({ error: limit }, 402);

  const kind = field(form, "kind") === "externa" ? "externa" : "propia";
  const input: StrategicInput = {
    kind,
    name: field(form, "name", 160) || (kind === "propia" ? company.name : ""),
    websiteUrl: field(form, "websiteUrl", 500),
    industry: field(form, "industry", 160) || (kind === "propia" ? company.industry ?? "" : ""),
    country: field(form, "country", 80) || company.country,
    notes: redactPersonalData(field(form, "notes", 4000)),
  };
  if (!input.name) return json({ error: "Indica el nombre de la empresa a analizar" }, 400);
  if (input.websiteUrl) {
    if (!/^https?:\/\//i.test(input.websiteUrl)) input.websiteUrl = `https://${input.websiteUrl}`;
    try { new URL(input.websiteUrl); } catch { return json({ error: "La URL del sitio web no es válida" }, 400); }
  }

  let pdf: Buffer | null = null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return json({ error: "El documento supera 8 MB" }, 400);
    input.docName = file.name.slice(0, 160);
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") pdf = Buffer.from(await file.arrayBuffer());
    else if (TEXT_EXT.test(file.name) || file.type.startsWith("text/")) {
      let text = await file.text();
      if (/\.html?$/i.test(file.name)) text = text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
      input.docText = redactPersonalData(text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim().slice(0, MAX_DOC_CHARS));
    } else return json({ error: "Formato no soportado: usa PDF, TXT, MD, CSV o HTML" }, 400);
  }
  if (!input.websiteUrl && !input.docName && !input.notes && kind === "externa")
    return json({ error: "Para otra empresa indica al menos su sitio web, un documento o una descripción" }, 400);

  const provider = ["mock", "claude-cli", "anthropic"].includes(field(form, "provider")) && process.env.COMPA_ALLOW_PROVIDER_OVERRIDE === "1" ? field(form, "provider") : undefined;
  let modules: unknown = null;
  try { modules = JSON.parse(String(form.get("modules") ?? "null")); } catch { /* todas */ }
  // Fase III: documento de referencia opcional para el diagnóstico de brechas (política o marco nacional).
  const refFile = form.get("refFile");
  let ref: { name: string; pdf?: Buffer; text?: string } | null = null;
  const refName = field(form, "refName", 200);
  if (refFile instanceof File && refFile.size > 0) {
    if (refFile.size > 15 * 1024 * 1024) return json({ error: "El documento de referencia supera 15 MB" }, 400);
    if (/\.pdf$/i.test(refFile.name) || refFile.type === "application/pdf") ref = { name: refName || refFile.name.slice(0, 200), pdf: Buffer.from(await refFile.arrayBuffer()) };
    else if (TEXT_EXT.test(refFile.name) || refFile.type.startsWith("text/")) ref = { name: refName || refFile.name.slice(0, 200), text: redactPersonalData((await refFile.text()).replace(/<[^>]+>/g, " ").replace(/[ \t]{2,}/g, " ").trim().slice(0, 60000)) };
    else return json({ error: "Documento de referencia: usa PDF, TXT, MD, CSV o HTML" }, 400);
  } else if (refName) ref = { name: refName };
  const id = createStrategic(company.id, input, normalizeModules(modules), provider);
  try {
    if (pdf) attachPdf(id, pdf);
    if (ref) addDoc(id, { role: "referencia", name: ref.name, pdf: ref.pdf, text: ref.text });
  } catch (e) {
    run("DELETE FROM strategic_analyses WHERE id = ?", id);
    throw e;
  }
  enqueueStrategic(id);
  return json({ id }, 201);
}
