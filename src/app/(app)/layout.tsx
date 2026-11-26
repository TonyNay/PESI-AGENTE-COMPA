import { requireSession } from "@/lib/auth";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { currentConsent } from "@/lib/account";
import { billingService } from "@/lib/billing/server";
import { renewalNotice } from "@/lib/billing/limits";
import { getDb } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform";

const shortDate = (ms: number) => new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" }).format(ms);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, company } = await requireSession();
  billingService(); // asegura las tablas de pagos antes de leer la vigencia
  const renewal = renewalNotice(getDb(), company.id);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar company={company.name} user={`${user.name} · ${user.email}`} platformAdmin={isPlatformAdmin(user.email)} />
      <main className="print-full min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">
          {!currentConsent(user.id) && <p className="no-print mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">Actualizamos nuestra política de privacidad y términos. <Link className="font-semibold text-brand underline" href="/account">Revísalos y acéptalos en Mi cuenta</Link>.</p>}
          {renewal && <p className="no-print mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">{renewal.state === "expiring"
            ? <>Tu plan {renewal.planName} vence {renewal.daysLeft <= 1 ? "en menos de un día" : `en ${renewal.daysLeft} días`} ({shortDate(renewal.activeUntil)}). </>
            : <>Tu plan {renewal.planName} venció el {shortDate(renewal.activeUntil)}; ahora rige la prueba gratuita. </>}
            <Link className="font-semibold text-brand underline" href="/billing">Renovar en Mi plan</Link></p>}
          {children}
        </div>
      </main>
    </div>
  );
}
