"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Complaint } from "@/lib/complaints";
import { ComplaintSheet, type ProviderInfo } from "./ComplaintSheet";

const EMPTY = {
  kind: "reclamo", consumerName: "", documentType: "DNI", documentNumber: "", address: "", phone: "", email: "",
  minor: false, guardianName: "", itemType: "servicio", itemDescription: "", amount: "", detail: "", request: "", responseChannel: "email",
};

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "No se pudo completar la solicitud.");
  return j as T;
}

export function ComplaintForm({ provider }: { provider: ProviderInfo }) {
  const [f, setF] = useState(EMPTY);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Complaint | null>(null);
  const [lookup, setLookup] = useState({ code: "", document: "" });
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target instanceof HTMLInputElement && e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const { complaint } = await call<{ complaint: Complaint }>("/api/complaints", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, acceptedPrivacy: accepted }),
      });
      setResult(complaint); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }
  async function find(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { setResult((await call<{ complaint: Complaint }>(`/api/complaints?${new URLSearchParams(lookup)}`)).complaint); }
    catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  if (result) return (
    <div className="space-y-4">
      <p role="status" className="no-print rounded-lg bg-emerald-50 px-3 py-2 text-good">Hoja registrada con el N.º <strong>{result.code}</strong>. Guárdala o imprímela; con ese número y tu documento puedes consultar la respuesta.</p>
      <ComplaintSheet c={result} provider={provider} />
      <div className="no-print flex flex-wrap gap-2"><button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir o guardar en PDF</button><button type="button" className="btn btn-ghost" onClick={() => { setResult(null); setF(EMPTY); setAccepted(false); }}>Registrar otra hoja</button></div>
    </div>
  );

  const field = (k: keyof typeof EMPTY, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className="label" htmlFor={`lr-${k}`}>{label}</label><input id={`lr-${k}`} className="input" value={String(f[k])} onChange={set(k)} disabled={busy} {...props} /></div>
  );
  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="space-y-6">
        <fieldset className="space-y-3"><legend className="font-semibold">1. Identificación del consumidor reclamante</legend>
          {field("consumerName", "Nombres y apellidos *", { required: true, minLength: 3, maxLength: 120, autoComplete: "name" })}
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <div><label className="label" htmlFor="lr-dt">Documento *</label><select id="lr-dt" className="input" value={f.documentType} onChange={set("documentType")} disabled={busy}>{["DNI", "CE", "Pasaporte", "RUC"].map((d) => <option key={d}>{d}</option>)}</select></div>
            {field("documentNumber", "Número *", { required: true, inputMode: f.documentType === "DNI" || f.documentType === "RUC" ? "numeric" : "text", maxLength: 15 })}
          </div>
          {field("address", "Domicilio *", { required: true, minLength: 5, maxLength: 200, autoComplete: "street-address" })}
          <div className="grid gap-3 sm:grid-cols-2">{field("phone", "Teléfono *", { required: true, type: "tel", autoComplete: "tel" })}{field("email", "Correo electrónico *", { required: true, type: "email", autoComplete: "email" })}</div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.minor} onChange={set("minor")} disabled={busy} /> Soy menor de edad</label>
          {f.minor && field("guardianName", "Nombre del padre, madre o apoderado *", { required: true, minLength: 3 })}
        </fieldset>

        <fieldset className="space-y-3"><legend className="font-semibold">2. Identificación del bien contratado</legend>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <div><label className="label" htmlFor="lr-it">Tipo *</label><select id="lr-it" className="input" value={f.itemType} onChange={set("itemType")} disabled={busy}><option value="servicio">Servicio</option><option value="producto">Producto</option></select></div>
            {field("amount", "Monto reclamado (S/)", { inputMode: "decimal", placeholder: "Opcional" })}
          </div>
          {field("itemDescription", "Descripción *", { required: true, minLength: 3, maxLength: 300, placeholder: "Ej.: Plan Pro de Compa, compra del 20/11/2026" })}
        </fieldset>

        <fieldset className="space-y-3"><legend className="font-semibold">3. Detalle de la reclamación y pedido</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {([["reclamo", "Reclamo", "Disconformidad con el servicio o producto contratado."], ["queja", "Queja", "Malestar por la atención recibida, no relacionado con el servicio."]] as const).map(([v, t, d]) => (
              <label key={v} className={`card cursor-pointer p-3 text-sm ${f.kind === v ? "border-brand ring-1 ring-brand" : ""}`}><input type="radio" name="kind" value={v} checked={f.kind === v} onChange={set("kind")} className="mr-2" disabled={busy} /><strong>{t}</strong><span className="mt-1 block text-xs text-soft">{d}</span></label>
            ))}
          </div>
          <div><label className="label" htmlFor="lr-detail">Detalle *</label><textarea id="lr-detail" required minLength={10} maxLength={3000} rows={5} className="input" value={f.detail} onChange={set("detail")} disabled={busy} /></div>
          <div><label className="label" htmlFor="lr-request">Pedido *</label><textarea id="lr-request" required minLength={5} maxLength={1500} rows={3} className="input" value={f.request} onChange={set("request")} disabled={busy} placeholder="¿Qué solución esperas?" /></div>
          <div><label className="label" htmlFor="lr-ch">Deseo recibir la respuesta por *</label><select id="lr-ch" className="input" value={f.responseChannel} onChange={set("responseChannel")} disabled={busy}><option value="email">Correo electrónico</option><option value="domicilio">Carta a mi domicilio</option></select></div>
        </fieldset>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} disabled={busy} /><span>Autorizo el tratamiento de mis datos para atender esta hoja, según la <Link className="font-semibold text-brand underline" href="/privacidad" target="_blank">política de privacidad</Link>.</span></label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Registrando…" : "Enviar hoja de reclamación"}</button>
        <p className="text-xs text-soft">Responderemos en un plazo máximo de 15 días hábiles improrrogables.</p>
      </form>

      <form onSubmit={find} className="space-y-3 border-t border-line pt-6">
        <h2 className="font-semibold">Consultar una hoja registrada</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div><label className="label" htmlFor="lr-code">N.º de hoja</label><input id="lr-code" required className="input" placeholder="000001-2026" value={lookup.code} onChange={(e) => setLookup({ ...lookup, code: e.target.value })} /></div>
          <div><label className="label" htmlFor="lr-doc">N.º de documento</label><input id="lr-doc" required className="input" value={lookup.document} onChange={(e) => setLookup({ ...lookup, document: e.target.value })} /></div>
          <button className="btn btn-ghost" disabled={busy}>Consultar</button>
        </div>
      </form>
    </div>
  );
}
