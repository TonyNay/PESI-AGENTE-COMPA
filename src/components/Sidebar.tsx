"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";

const NAV = [
  { href: "/dashboard", label: "Panel", icon: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" },
  { href: "/products", label: "Productos y servicios", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { href: "/strategy", label: "Análisis estratégico", icon: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 100 12 6 6 0 000-12zm0 4a2 2 0 100 4 2 2 0 000-4z" },
];

const ADMIN_NAV = [
  { href: "/admin/metrics", label: "Métricas del negocio", icon: "M4 19V9m6 10V5m6 14v-7m4 7H2" },
  { href: "/admin/reclamaciones", label: "Libro de Reclamaciones", icon: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5" },
];

export function Sidebar({ company, user, platformAdmin = false }: { company: string; user: string; platformAdmin?: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  const link = (n: { href: string; label: string; icon: string }) => {
    const active = path === n.href || path.startsWith(n.href + "/");
    return (
      <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? "bg-white/12 text-white" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
        {n.label}
      </Link>
    );
  };
  const nav = (
    <nav className="mt-6 flex flex-col gap-1">
      {NAV.map(link)}
      {platformAdmin && <>
        <p className="mt-5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Administración de Compa</p>
        {ADMIN_NAV.map(link)}
      </>}
    </nav>
  );
  const footer = (
    <div className="mt-auto border-t border-white/10 pt-4">
      <Link href="/billing" onClick={() => setOpen(false)} className="mb-4 flex items-center justify-between rounded-lg border border-white/15 px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/8 hover:text-white">
        <span className="flex items-center gap-2"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M3 5h18v14H3zM3 10h18M7 15h4" /></svg>Mi plan</span><span aria-hidden>↗</span>
      </Link>
      <Link href="/account" onClick={() => setOpen(false)} className="mb-3 block text-sm text-slate-300 underline-offset-2 hover:text-white hover:underline">Mi cuenta y privacidad</Link>
      <p className="truncate text-sm font-semibold text-white">{company}</p>
      <p className="truncate text-xs text-slate-400">{user}</p>
      <button onClick={logout} className="mt-3 text-xs font-semibold text-slate-300 underline-offset-2 hover:text-white hover:underline">Cerrar sesión</button>
    </div>
  );
  return (
    <>
      <div className="no-print sticky top-0 z-30 flex items-center justify-between bg-[#0f1b33] px-4 py-3 md:hidden">
        <Logo dark />
        <button onClick={() => setOpen(!open)} aria-label="Menú" className="rounded-md p-1.5 text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </div>
      {open && (
        <div className="no-print fixed inset-x-0 top-[52px] z-20 flex min-h-[60vh] flex-col bg-[#0f1b33] p-4 md:hidden">{nav}{footer}</div>
      )}
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#0f1b33] p-5 md:flex">
        <Logo dark />
        {nav}
        {footer}
      </aside>
    </>
  );
}
