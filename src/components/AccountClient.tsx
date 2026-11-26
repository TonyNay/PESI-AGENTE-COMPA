"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { TwoFactorCard } from "./TwoFactorCard";

type Props = {
  user: { name: string; email: string; role: string };
  company: { name: string; tax_id: string | null; industry: string | null };
  consent: { version: string; accepted_at: string } | null;
  version: string;
  protectedAccount: boolean;
  twoFactor: { enabled: boolean; recoveryLeft: number };
};

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "No se pudo completar la solicitud.");
  return j;
}

export function AccountClient({ user, company, consent, version, protectedAccount, twoFactor }: Props) {
  const router = useRouter();
  const admin = user.role === "admin";
  const [f, setF] = useState({ name: user.name, companyName: company.name, taxId: company.tax_id ?? "", industry: company.industry ?? "" });
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true); setStatus(null);
    try { await action(); if (success) setStatus({ kind: "ok", text: success }); router.refresh(); }
    catch (e) { setStatus({ kind: "error", text: (e as Error).message }); }
    setBusy(false);
  }
  function save(e: FormEvent) {
    e.preventDefault();
    void run(() => send("/api/account", "PATCH", f), "Tus datos se actualizaron.");
  }
  function remove(e: FormEvent) {
    e.preventDefault();
    void run(async () => { await send("/api/account", "DELETE", { password }); router.push("/"); });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {status && <p role={status.kind === "error" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm lg:col-span-2 ${status.kind === "error" ? "bg-red-50 text-bad" : "bg-emerald-50 text-good"}`}>{status.text}</p>}

      <form onSubmit={save} className="card space-y-4 p-5">
        <h2 className="font-semibold">Mis datos</h2>
        <div><label className="label" htmlFor="acc-name">Nombre</label><input id="acc-name" required className="input" value={f.name} onChange={set("name")} /></div>
        <div><label className="label" htmlFor="acc-email">Correo de acceso</label><input id="acc-email" className="input" value={user.email} disabled /></div>
        <div><label className="label" htmlFor="acc-company">Empresa</label><input id="acc-company" required disabled={!admin} className="input" value={f.companyName} onChange={set("companyName")} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="acc-ruc">RUC</label><input id="acc-ruc" inputMode="numeric" maxLength={11} disabled={!admin} className="input" value={f.taxId} onChange={set("taxId")} /></div>
          <div><label className="label" htmlFor="acc-industry">Rubro</label><input id="acc-industry" disabled={!admin} className="input" value={f.industry} onChange={set("industry")} /></div>
        </div>
        <button className="btn btn-primary" disabled={busy}>Guardar cambios</button>
      </form>

      <div className="space-y-5">
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Privacidad y consentimiento</h2>
          {consent
            ? <p className="text-sm text-soft">Aceptaste la versión {consent.version} de la <Link className="text-brand underline" href="/privacidad">política de privacidad</Link> y los <Link className="text-brand underline" href="/terminos">términos</Link> el {new Date(`${consent.accepted_at}Z`).toLocaleDateString("es-PE", { timeZone: "America/Lima", dateStyle: "medium" })}.</p>
            : <>
              <p className="text-sm text-soft">Aún no aceptas la versión {version} de la <Link className="text-brand underline" href="/privacidad">política de privacidad</Link> y los <Link className="text-brand underline" href="/terminos">términos</Link>.</p>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(() => send("/api/account/consent", "POST"), "Consentimiento registrado.")}>He leído y acepto</button>
            </>}
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Copia de mis datos</h2>
          <p className="text-sm text-soft">Descarga un archivo con tu perfil, catálogo, análisis, pagos y comprobantes.</p>
          <a className="btn btn-ghost inline-block" href="/api/account/export">Descargar mis datos (JSON)</a>
        </section>

        <TwoFactorCard status={twoFactor} />

        <section className="card space-y-3 border-red-200 p-5">
          <h2 className="font-semibold">Eliminar mi cuenta</h2>
          <p className="text-sm text-soft">Se borran tus datos personales y, si eres el único usuario, el catálogo y los análisis de la empresa. Los comprobantes se conservan por obligación tributaria.</p>
          {protectedAccount
            ? <p className="text-sm text-soft">La cuenta de demostración está protegida y no se puede eliminar.</p>
            : !confirming
              ? <button type="button" className="btn btn-ghost text-bad" onClick={() => setConfirming(true)}>Eliminar mi cuenta</button>
              : <form onSubmit={remove} className="space-y-3">
                <div><label className="label" htmlFor="acc-password">Confirma con tu contraseña</label><input id="acc-password" type="password" required autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-primary" disabled={busy}>{busy ? "Eliminando…" : "Eliminar definitivamente"}</button>
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setConfirming(false); setPassword(""); }}>Cancelar</button>
                </div>
              </form>}
        </section>
      </div>
    </div>
  );
}
