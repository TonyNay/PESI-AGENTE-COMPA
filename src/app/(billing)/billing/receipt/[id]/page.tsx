import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { requireSession } from "@/lib/auth";
import { soles } from "@/lib/billing/catalog";
import { billingService } from "@/lib/billing/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, company } = await requireSession();
  const receipt = billingService().receipt({ companyId: company.id, userId: user.id, name: user.name, email: user.email, role: user.role }, (await params).id);
  if (!receipt) notFound();
  const issued = new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short", timeZone: "America/Lima" }).format(receipt.issuedAt);
  return <article className="card mx-auto max-w-2xl space-y-6 p-6 text-sm sm:p-8">
    <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-medium">Representación de demostración. Sin valor tributario: no fue enviada a la SUNAT.</p>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="display text-2xl">Compa</h1><p className="text-soft">Proyecto académico · Emisor sin RUC</p></div>
      <div className="rounded-lg border border-line px-4 py-3 text-right"><p className="font-semibold">{receipt.type === "factura" ? "Factura electrónica" : "Boleta de venta electrónica"}</p><p className="tabular-nums">{receipt.number}</p></div>
    </header>
    <dl className="grid gap-3 sm:grid-cols-2">
      <div><dt className="text-soft">Cliente</dt><dd className="font-medium">{receipt.customerName}</dd></div>
      <div><dt className="text-soft">{receipt.type === "factura" ? "RUC" : "DNI"}</dt><dd className="font-medium tabular-nums">{receipt.documentNumber ?? "No indicado"}</dd></div>
      <div><dt className="text-soft">Fecha de emisión</dt><dd className="font-medium">{issued}</dd></div>
      <div><dt className="text-soft">Medio de pago</dt><dd className="font-medium">{receipt.method} · {receipt.mode === "TEST" ? "Pruebas de Culqi" : "Simulador"}</dd></div>
    </dl>
    <table className="w-full">
      <thead><tr className="border-y border-line text-left text-xs uppercase tracking-wide text-soft"><th className="py-2">Descripción</th><th className="py-2 text-right">Importe</th></tr></thead>
      <tbody>
        <tr className="border-b border-line"><td className="py-3">Plan {receipt.planName} · acceso por 31 días</td><td className="py-3 text-right tabular-nums">{soles(receipt.base)}</td></tr>
        <tr><td className="pt-3 text-right text-soft">Valor de venta</td><td className="pt-3 text-right tabular-nums">{soles(receipt.base)}</td></tr>
        <tr><td className="pt-1 text-right text-soft">IGV (18 %)</td><td className="pt-1 text-right tabular-nums">{soles(receipt.igv)}</td></tr>
        <tr><td className="pt-2 text-right font-semibold">Total</td><td className="pt-2 text-right font-semibold tabular-nums">{soles(receipt.total)}</td></tr>
      </tbody>
    </table>
    {receipt.creditNote && <section className="space-y-3 border-t border-line pt-5" aria-label="Nota de crédito">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="font-semibold">Nota de crédito electrónica</h2><p className="text-soft">Modifica a {receipt.creditNote.reference} · {new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short", timeZone: "America/Lima" }).format(receipt.creditNote.issuedAt)}</p></div>
        <p className="rounded-lg border border-line px-4 py-2 text-right font-semibold tabular-nums">{receipt.creditNote.number}</p>
      </div>
      <p>Motivo: {receipt.creditNote.reason}</p>
      <dl className="grid grid-cols-3 gap-3 text-right tabular-nums">
        <div><dt className="text-soft">Valor de venta</dt><dd>- {soles(receipt.creditNote.base)}</dd></div>
        <div><dt className="text-soft">IGV (18 %)</dt><dd>- {soles(receipt.creditNote.igv)}</dd></div>
        <div><dt className="text-soft">Total</dt><dd className="font-semibold">- {soles(receipt.creditNote.total)}</dd></div>
      </dl>
    </section>}
    <div className="no-print flex flex-wrap gap-3"><PrintButton /><Link href="/billing" className="btn btn-ghost">Volver a mis pagos</Link></div>
  </article>;
}
