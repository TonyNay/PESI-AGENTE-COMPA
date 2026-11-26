import { apiSession, json } from "@/lib/api";
import { get } from "@/lib/db";
import { redactPersonalData } from "@/lib/privacy";
import { addDoc, deleteDoc, listDocs } from "@/lib/td-docs";
import type { StrategicRow } from "@/lib/types";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_DOC_CHARS = 60000;
const TEXT_EXT = /\.(txt|md|markdown|csv|json|html?)$/i;
const MAX_DOCS = 6;

async function owned(params: Promise<{ id: string }>) {
  const r = await apiSession();
  if ("error" in r) return { error: r.error };
  const id = Number((await params).id);
  const a = get<StrategicRow>("SELECT * FROM strategic_analyses WHERE id = ? AND company_id = ?", id, r.session.company.id);
  if (!a) return { error: json({ error: "No encontrado" }, 404) };
  return { a };
}
const view = (id: number) => listDocs(id).map(({ text_content, path, ...d }) => ({ ...d, kind: path ? "pdf" : text_content ? "texto" : d.url ? "enlace" : "nombre", chars: text_content?.length ?? 0 }));

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = await owned(params);
  if ("error" in o) return o.error;
  return json({ documents: view(o.a.id) });
}

/** Sube un documento institucional o de referencia (PDF o texto), o registra un marco por su nombre/URL oficial. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = await owned(params);
  if ("error" in o) return o.error;
  const { a } = o;
  if (a.status === "queued" || a.status === "running") return json({ error: "Espera a que termine el trabajo en curso" }, 409);
  if (listDocs(a.id).length >= MAX_DOCS) return json({ error: `Máximo ${MAX_DOCS} documentos por análisis` }, 400);
  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "Formulario inválido" }, 400);
  const role = String(form.get("role")) === "institucional" ? "institucional" : "referencia";
  let name = String(form.get("name") ?? "").trim().slice(0, 200);
  let url = String(form.get("url") ?? "").trim().slice(0, 500) || null;
  if (url) {
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try { new URL(url); } catch { return json({ error: "La URL no es válida" }, 400); }
  }
  let text: string | null = null, pdf: Buffer | null = null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return json({ error: "El documento supera 15 MB" }, 400);
    name ||= file.name.slice(0, 200);
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") pdf = Buffer.from(await file.arrayBuffer());
    else if (TEXT_EXT.test(file.name) || file.type.startsWith("text/")) {
      let t = await file.text();
      if (/\.html?$/i.test(file.name)) t = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
      text = redactPersonalData(t.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim().slice(0, MAX_DOC_CHARS));
    } else return json({ error: "Formato no soportado: usa PDF, TXT, MD, CSV o HTML" }, 400);
  }
  if (!name) return json({ error: "Indica el nombre del documento o sube un archivo" }, 400);
  addDoc(a.id, { role, name, text, pdf, url });
  return json({ documents: view(a.id) }, 201);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = await owned(params);
  if ("error" in o) return o.error;
  if (o.a.status === "queued" || o.a.status === "running") return json({ error: "Espera a que termine el trabajo en curso" }, 409);
  const doc = Number(new URL(req.url).searchParams.get("doc"));
  if (!deleteDoc(o.a.id, doc)) return json({ error: "Documento no encontrado" }, 404);
  return json({ documents: view(o.a.id) });
}
