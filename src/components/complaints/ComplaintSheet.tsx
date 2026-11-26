import type { Complaint } from "@/lib/complaints";

export type ProviderInfo = { name: string; ruc: string; address: string; email: string };

const fmt = (ms: number, time = true) => new Intl.DateTimeFormat("es-PE", { dateStyle: "long", ...(time ? { timeStyle: "short" } : {}), timeZone: "America/Lima" }).format(ms);
const money = (cents: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(cents / 100);

/** Representación de la Hoja de Reclamación con los cuatro bloques del formato oficial. */
export function ComplaintSheet({ c, provider }: { c: Complaint; provider: ProviderInfo }) {
  const row = (label: string, value: React.ReactNode) => <div className="grid gap-1 border-b border-line py-2 sm:grid-cols-[200px_1fr]"><dt className="text-soft">{label}</dt><dd className="font-medium break-words">{value}</dd></div>;
  return (
    <article className="space-y-5 text-sm" aria-label={`Hoja de reclamación ${c.code}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line p-4">
        <div><p className="eyebrow">Libro de Reclamaciones virtual</p><h2 className="display mt-1 text-xl font-bold">Hoja de Reclamación</h2><p className="text-soft">Fecha: {fmt(c.createdAt)}</p></div>
        <div className="text-right"><p className="text-soft">N.º</p><p className="display text-xl font-bold tabular-nums">{c.code}</p></div>
        <p className="w-full text-xs text-soft">{provider.name} · RUC {provider.ruc} · {provider.address}</p>
      </header>
      <section><h3 className="font-semibold">1. Identificación del consumidor reclamante</h3><dl className="mt-1">
        {row("Nombre", c.consumerName)}{row("Documento", `${c.documentType} ${c.documentNumber}`)}{row("Domicilio", c.address)}
        {row("Teléfono / correo", `${c.phone} · ${c.email}`)}{c.minor && row("Padre, madre o apoderado", c.guardianName)}
      </dl></section>
      <section><h3 className="font-semibold">2. Identificación del bien contratado</h3><dl className="mt-1">
        {row("Tipo", c.itemType === "servicio" ? "Servicio" : "Producto")}{row("Monto reclamado", c.amount != null ? money(c.amount) : "No indicado")}{row("Descripción", c.itemDescription)}
      </dl></section>
      <section><h3 className="font-semibold">3. Detalle de la reclamación y pedido del consumidor</h3><dl className="mt-1">
        {row("Tipo", c.kind === "reclamo" ? "Reclamo: disconformidad con el servicio" : "Queja: malestar por la atención")}
        {row("Detalle", <span className="whitespace-pre-line">{c.detail}</span>)}{row("Pedido", <span className="whitespace-pre-line">{c.request}</span>)}
        {row("Respuesta por", c.responseChannel === "email" ? "Correo electrónico" : "Carta al domicilio")}
      </dl></section>
      <section><h3 className="font-semibold">4. Observaciones y acciones adoptadas por el proveedor</h3><dl className="mt-1">
        {c.response ? <>{row("Fecha de respuesta", fmt(c.respondedAt!))}{row("Respuesta", <span className="whitespace-pre-line">{c.response}</span>)}</>
          : row("Estado", <>Pendiente · plazo máximo: {fmt(c.dueAt, false)}</>)}
      </dl></section>
      <p className="rounded-lg bg-[#f6f5f1] p-3 text-xs leading-relaxed text-soft">
        La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.
        El proveedor debe dar respuesta al reclamo o queja en un plazo no mayor a quince (15) días hábiles improrrogables.
      </p>
    </article>
  );
}
