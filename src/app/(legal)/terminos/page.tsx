import Link from "next/link";
import { LEGAL_VERSION } from "@/lib/legal";

export const metadata = { title: "Términos del servicio · Compa" };

export default function TermsPage() {
  return <>
    <h1 className="display text-3xl">Términos del servicio</h1>
    <p className="text-soft">Versión {LEGAL_VERSION} · Proyecto académico Compa</p>
    <p>Compa es un prototipo universitario y sus pagos funcionan solo en modo de prueba. Una versión comercial requerirá constituir la empresa y publicar condiciones definitivas.</p>

    <h2>El servicio</h2>
    <p>Compa compara tus productos con ofertas públicas de otras tiendas y genera análisis estratégicos con inteligencia artificial. Cada cuenta pertenece a una empresa y su información no es visible para otras empresas.</p>

    <h2>Planes y precios</h2>
    <p>Los planes dan acceso por 31 días, se pagan una sola vez y no se renuevan automáticamente. Los precios están en soles e incluyen IGV. Cada plan fija un número de análisis y de productos; sin un plan activo rige una prueba gratuita limitada. Antes del vencimiento te avisamos para que renueves. Cada compra tiene una garantía de 7 días: si usaste hasta 5 análisis, puedes pedir el reembolso total desde Mi plan. Consulta las <Link className="text-brand underline" href="/billing/conditions">condiciones de compra</Link>.</p>

    <h2>Programa de referidos</h2>
    <p>Cada empresa tiene un código para invitar a otras. Cuando una empresa invitada paga su primer plan, la empresa que la invitó recibe 31 días adicionales (hasta 12 veces). No cuenta invitar a la misma empresa con otra cuenta o el mismo RUC, y la recompensa se revierte si el pago que la originó se reembolsa.</p>

    <h2>Reclamos y quejas</h2>
    <p>Puedes registrar un reclamo o una queja en nuestro <Link className="text-brand underline" href="/libro-reclamaciones">Libro de Reclamaciones virtual</Link>, tengas o no una cuenta. Respondemos en un plazo máximo de 15 días hábiles improrrogables.</p>

    <h2>Inteligencia artificial y responsabilidad</h2>
    <p>Los reportes son una ayuda para decidir, no asesoría comercial, legal ni tributaria. Pueden contener errores y los precios cambian. Revisa las fuentes enlazadas antes de actuar: la decisión final es tuya.</p>

    <h2>Uso aceptable</h2>
    <p>Debes contar con autorización para subir la información que cargues y no puedes usar Compa para actividades ilícitas, para concertar precios con competidores ni para vulnerar la plataforma.</p>

    <h2>Propiedad intelectual</h2>
    <p>Tu catálogo y tus datos siguen siendo tuyos. El software, la marca y el diseño de Compa pertenecen a sus autores. Los reportes generados para tu empresa son de uso de tu empresa.</p>

    <h2>Información de terceros y aviso de retiro</h2>
    <p>Compa solo conserva datos fácticos de cada oferta, como precio, disponibilidad y enlace de origen, y no reproduce fotografías ni logotipos de otras tiendas. El agente no evade bloqueos de acceso. Las ofertas con un precio inusualmente bajo se marcan para su verificación, sin afirmar que sean falsificaciones.</p>
    <p>Si eres titular de un sitio o de un derecho y deseas que retiremos información o excluyamos tu dominio, escribe al administrador de esta instalación indicando el enlace y el motivo. Atendida la solicitud, el dominio se excluye de los análisis siguientes.</p>

    <h2>Protección de datos</h2>
    <p>El tratamiento de datos personales se describe en la <Link className="text-brand underline" href="/privacidad">política de privacidad</Link>.</p>

    <h2>Ley aplicable</h2>
    <p>Estos términos se rigen por las leyes de la República del Perú.</p>
  </>;
}
