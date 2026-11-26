"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { LEGAL_VERSION } from "@/lib/legal";

async function post(url: string, body?: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Error inesperado");
  return j;
}

export function LoginForm({ allowRegister }: { allowRegister: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "", code: "" });
  const [needsCode, setNeedsCode] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const j = await post("/api/auth/login", f);
      if (j.requires2fa) { setNeedsCode(true); setBusy(false); return; }
      router.push("/dashboard"); router.refresh();
    }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {needsCode
        ? <div><label className="label" htmlFor="code">Código de verificación</label><input id="code" required autoFocus autoComplete="one-time-code" className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /><p className="mt-1 text-xs text-soft">Ingresa el código de tu aplicación o uno de recuperación.</p></div>
        : <>
      <div><label className="label" htmlFor="email">Correo</label><input id="email" type="email" required className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      <div><label className="label" htmlFor="password">Contraseña</label><input id="password" type="password" required className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
      </>}
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{err}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Ingresando…" : "Iniciar sesión"}</button>
      {allowRegister
        ? <p className="text-center text-sm text-soft">¿No tienes cuenta? <Link href="/register" className="font-semibold text-brand underline-offset-2 hover:underline">Regístrate</Link></p>
        : <p className="text-center text-sm text-soft">El acceso es solo por invitación. Pide tus credenciales al administrador.</p>}
    </form>
  );
}

export function RegisterForm({ referralCode = "" }: { referralCode?: string }) {
  const router = useRouter();
  const [f, setF] = useState({ companyName: "", taxId: "", industry: "", country: "Perú", currency: "PEN", name: "", email: "", password: "", referralCode });
  const [accepted, setAccepted] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await post("/api/auth/register", { ...f, acceptedLegal: accepted ? LEGAL_VERSION : null }); router.push("/dashboard"); router.refresh(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="eyebrow">Tu empresa</p>
      <div><label className="label" htmlFor="cn">Nombre de la empresa *</label><input id="cn" required className="input" value={f.companyName} onChange={set("companyName")} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="ruc">RUC (opcional)</label><input id="ruc" className="input" value={f.taxId} onChange={set("taxId")} /></div>
        <div><label className="label" htmlFor="ind">Rubro</label><input id="ind" className="input" placeholder="Retail, tecnología…" value={f.industry} onChange={set("industry")} /></div>
        <div><label className="label" htmlFor="co">País</label><input id="co" className="input" value={f.country} onChange={set("country")} /></div>
        <div><label className="label" htmlFor="cu">Moneda</label>
          <select id="cu" className="input" value={f.currency} onChange={set("currency")}>{["PEN", "USD", "EUR", "MXN", "COP", "CLP"].map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <p className="eyebrow pt-2">Administrador</p>
      <div><label className="label" htmlFor="nm">Tu nombre *</label><input id="nm" required className="input" value={f.name} onChange={set("name")} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="em">Correo *</label><input id="em" type="email" required className="input" value={f.email} onChange={set("email")} /></div>
        <div><label className="label" htmlFor="pw">Contraseña * (mín. 8)</label><input id="pw" type="password" minLength={8} required className="input" value={f.password} onChange={set("password")} /></div>
      </div>
      <div><label className="label" htmlFor="ref">Código de referido (opcional)</label><input id="ref" className="input" placeholder="COMPA-XXXXXX" maxLength={20} value={f.referralCode} onChange={set("referralCode")} /><p className="mt-1 text-xs text-soft">Si otra empresa te invitó, ella recibe un mes adicional cuando pagues tu primer plan.</p></div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{err}</p>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /><span>He leído y acepto la <Link href="/privacidad" target="_blank" className="font-semibold text-brand underline">política de privacidad</Link>, incluido el envío de datos a un proveedor de IA en el extranjero, y los <Link href="/terminos" target="_blank" className="font-semibold text-brand underline">términos del servicio</Link>.</span></label>
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Creando cuenta…" : "Crear cuenta"}</button>
      <p className="text-center text-sm text-soft">¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-brand underline-offset-2 hover:underline">Inicia sesión</Link></p>
    </form>
  );
}
