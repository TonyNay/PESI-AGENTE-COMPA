"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { fmtMoney } from "@/lib/format";
import type { Product } from "@/lib/types";

type Form = { id?: number; type: string; name: string; brand: string; category: string; description: string; price: string; currency: string; sku: string; url: string; keywords: string };
const empty = (cur: string): Form => ({ type: "producto", name: "", brand: "", category: "", description: "", price: "", currency: cur, sku: "", url: "", keywords: "" });

export function ProductsClient({ products, currency }: { products: Product[]; currency: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<number | "save" | "csv" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy("save"); setErr("");
    const r = await fetch(form.id ? `/api/products/${form.id}` : "/api/products", {
      method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, price: Number(form.price) }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setErr(j.error || "No se pudo guardar");
    setForm(null); router.refresh();
  }
  async function del(p: Product) {
    if (!confirm(`¿Eliminar "${p.name}" y todos sus análisis?`)) return;
    await fetch(`/api/products/${p.id}`, { method: "DELETE" });
    router.refresh();
  }
  async function analyze(p: Product) {
    setBusy(p.id); setMsg("");
    const r = await fetch("/api/analyses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: p.id }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(null); return setMsg(j.error || "No se pudo iniciar el análisis"); }
    router.push(`/analyses/${j.id}`);
  }
  async function importCsv(file: File) {
    setBusy("csv"); setMsg("");
    const csv = await file.text();
    const r = await fetch("/api/products/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
    if (!r.ok) return setMsg(j.error || "Error al importar");
    const skipped = j.skipped?.length ? ` Omitidas: ${j.skipped.length}.` : "";
    setMsg(`Formato detectado: ${j.formatLabel}. Nuevos: ${j.imported} · actualizados por SKU: ${j.updated}.${skipped}${j.errors?.length ? " Errores: " + j.errors.join(" | ") : ""}`);
    router.refresh();
  }
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form!, [k]: e.target.value });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => { setErr(""); setForm(empty(currency)); }}>+ Nuevo ítem</button>
        <button className="btn btn-ghost" disabled={busy === "csv"} onClick={() => fileRef.current?.click()}>{busy === "csv" ? "Importando…" : "Importar CSV"}</button>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="btn btn-ghost" href="/api/products/template">Descargar plantilla</a>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
      </div>
      <p className="-mt-2 mb-4 text-xs text-soft">Acepta la plantilla de Compa y la exportación de productos de <strong>Shopify</strong> o <strong>WooCommerce</strong>. Si un SKU ya existe, se actualiza su precio en lugar de duplicarlo.</p>
      {msg && <p className="mb-4 rounded-lg border border-line bg-white px-3 py-2 text-sm">{msg}</p>}

      {products.length === 0 ? (
        <div className="card border-dashed p-10 text-center text-sm text-soft">Aún no tienes productos ni servicios. Crea uno o carga un CSV.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-soft">
              <th className="px-4 py-3">Nombre</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Marca / categoría</th><th className="px-3 py-3 text-right">Precio</th><th className="px-4 py-3 text-right">Acciones</th>
            </tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-[#fbfaf7]">
                  <td className="px-4 py-3"><Link href={`/products/${p.id}`} className="font-semibold hover:text-brand">{p.name}</Link>{p.sku && <div className="text-xs text-soft">SKU {p.sku}</div>}</td>
                  <td className="px-3 py-3"><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize">{p.type}</span></td>
                  <td className="px-3 py-3 text-soft">{[p.brand, p.category].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{fmtMoney(p.price, p.currency)}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1.5">
                    <button className="btn btn-primary !px-3 !py-1.5" disabled={busy === p.id} onClick={() => analyze(p)}>{busy === p.id ? "Iniciando…" : "Analizar mercado"}</button>
                    <button className="btn btn-ghost !px-3 !py-1.5" onClick={() => { setErr(""); setForm({ id: p.id, type: p.type, name: p.name, brand: p.brand ?? "", category: p.category ?? "", description: p.description ?? "", price: String(p.price), currency: p.currency, sku: p.sku ?? "", url: p.url ?? "", keywords: p.keywords ?? "" }); }}>Editar</button>
                    <button className="btn btn-danger !px-3 !py-1.5" onClick={() => del(p)}>Eliminar</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/50 p-4" onClick={() => setForm(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="card my-8 w-full max-w-xl space-y-4 p-6 shadow-xl">
            <h2 className="display text-xl font-bold">{form.id ? "Editar ítem" : "Nuevo producto o servicio"}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="label">Tipo</label><select className="input" value={form.type} onChange={set("type")}><option value="producto">Producto</option><option value="servicio">Servicio</option></select></div>
              <div className="sm:col-span-2"><label className="label">Nombre *</label><input className="input" required value={form.name} onChange={set("name")} /></div>
              <div><label className="label">Marca</label><input className="input" value={form.brand} onChange={set("brand")} /></div>
              <div><label className="label">Categoría</label><input className="input" value={form.category} onChange={set("category")} /></div>
              <div><label className="label">SKU</label><input className="input" value={form.sku} onChange={set("sku")} /></div>
              <div><label className="label">Precio *</label><input className="input" type="number" step="0.01" min="0" required value={form.price} onChange={set("price")} /></div>
              <div><label className="label">Moneda</label><select className="input" value={form.currency} onChange={set("currency")}>{["PEN", "USD", "EUR", "MXN", "COP", "CLP"].map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="label">URL propia</label><input className="input" type="url" placeholder="https://…" value={form.url} onChange={set("url")} /></div>
            </div>
            <div><label className="label">Descripción</label><textarea className="input" rows={2} value={form.description} onChange={set("description")} /></div>
            <div><label className="label">Palabras clave (separadas por coma)</label><input className="input" value={form.keywords} onChange={set("keywords")} /></div>
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{err}</p>}
            <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy === "save"}>{busy === "save" ? "Guardando…" : "Guardar"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
