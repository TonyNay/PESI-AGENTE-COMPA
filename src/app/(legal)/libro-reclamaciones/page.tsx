import type { Metadata } from "next";
import { ComplaintForm } from "@/components/complaints/ComplaintForm";
import { providerInfo } from "@/lib/platform";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Libro de Reclamaciones · Compa",
  description: "Registra un reclamo o una queja sobre el servicio de Compa. Respondemos en un máximo de 15 días hábiles.",
};

export default function ComplaintsBookPage() {
  const provider = providerInfo();
  return <>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="eyebrow">Conforme al Código de Protección y Defensa del Consumidor</p><h1 className="display mt-1 text-2xl font-bold">Libro de Reclamaciones</h1></div>
      <span className="rounded-md border border-line px-2 py-1 text-xs font-semibold">Hoja virtual</span>
    </div>
    <dl className="grid gap-2 rounded-lg bg-[#f6f5f1] p-3 text-xs sm:grid-cols-2">
      <div><dt className="text-soft">Proveedor</dt><dd className="font-medium">{provider.name}</dd></div>
      <div><dt className="text-soft">RUC</dt><dd className="font-medium">{provider.ruc}</dd></div>
      <div><dt className="text-soft">Domicilio</dt><dd className="font-medium">{provider.address}</dd></div>
      <div><dt className="text-soft">Correo</dt><dd className="font-medium">{provider.email}</dd></div>
    </dl>
    <p className="text-soft">Puedes registrar un reclamo o una queja aunque no tengas cuenta en Compa. Al enviarla verás tu hoja con su número correlativo, lista para imprimir o guardar.</p>
    <ComplaintForm provider={provider} />
  </>;
}
