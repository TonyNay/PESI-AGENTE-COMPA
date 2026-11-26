import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Planes y facturación · Compa" };

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  const { company } = await requireSession();
  return <div className="min-h-screen">
    <header className="no-print border-b border-line bg-white/90 px-5 sm:px-8">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-5 sm:gap-8"><Link href="/dashboard" aria-label="Compa, volver al panel"><Logo /></Link><span className="hidden h-5 border-l border-line sm:block" /><span className="hidden text-sm text-soft sm:block">Mi cuenta</span></div>
        <div className="flex min-w-0 items-center gap-5"><span className="hidden max-w-56 truncate text-sm font-medium md:block">{company.name}</span><Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-soft hover:text-brand"><span aria-hidden>←</span> Volver al panel</Link></div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">{children}</main>
  </div>;
}
