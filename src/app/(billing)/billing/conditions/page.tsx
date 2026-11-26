import Link from "next/link";
import { BILLING_TERMS_VERSION, REFUND_MAX_ANALYSES, REFUND_WINDOW_DAYS, RENEWAL_NOTICE_DAYS } from "@/lib/billing/catalog";

export default function PaymentConditions() {
  return <article className="card mx-auto max-w-3xl space-y-5 p-6 text-sm leading-relaxed">
    <Link href="/billing" className="text-brand">← Planes y pagos</Link>
    <h1 className="display text-3xl">Condiciones de la demostración</h1>
    <p className="text-soft">Versión {BILLING_TERMS_VERSION} · Proyecto académico Compa</p>
    <p>Compa permite comparar precios del mercado y generar análisis estratégicos para empresas. Los planes Emprendedor, Pro y Empresa son una propuesta comercial para demostrar su proceso de compra. Sus precios se muestran en soles e incluyen IGV (18 %).</p>
    <h2 className="text-lg font-semibold">Pagos de prueba y simulación</h2>
    <p>Este entorno solo acepta llaves de prueba de Culqi. Utiliza las tarjetas y números de prueba indicados en la pantalla de pagos; no ingreses datos bancarios reales. La disponibilidad de cada medio depende de la cuenta de prueba de Culqi y del importe de la compra.</p>
    <p>El simulador local es una demostración independiente: no contacta a Culqi ni a un banco y no genera un QR cobrable. Sus operaciones y planes activos se identifican como SIMULATED. Las operaciones verificadas mediante Culqi se identifican como TEST. Ninguna representa un cobro de producción.</p>
    <h2 className="text-lg font-semibold">Planes, vigencia y activación</h2>
    <p>Cada compra aprobada activa el plan seleccionado durante 31 días para la empresa de la cuenta. Una nueva compra suma 31 días a la vigencia restante del mismo entorno y cambia el plan al elegido. No hay renovación ni débito automático: {RENEWAL_NOTICE_DAYS} días antes del vencimiento verás un aviso para renovar si lo deseas. Al llegar al límite de análisis del mes o de productos del plan vigente, debes ampliar el plan para continuar; no se cobran excedentes. Sin un plan activo rige una prueba gratuita limitada.</p>
    <p>Un pago pendiente, rechazado o la sola generación de un código no activa el plan. Culqi debe confirmar el pago a nuestro servidor. Las simulaciones requieren seleccionar explícitamente un resultado. Repetir la confirmación de una misma compra no suma días adicionales.</p>
    <h2 className="text-lg font-semibold">Cancelaciones y devoluciones</h2>
    <p>Puedes abandonar una orden pendiente sin activar el plan. Cada compra pagada tiene una <strong>garantía de {REFUND_WINDOW_DAYS} días</strong>: si desde la compra usaste hasta {REFUND_MAX_ANALYSES} análisis (de precios o estratégicos), un administrador de tu empresa puede pedir el reembolso total desde Mi plan, indicando el motivo.</p>
    <p>Al reembolsarse se descuentan los 31 días de esa compra de la vigencia del plan y se emite una nota de crédito que anula el comprobante. Los pagos con tarjeta o Yape se devuelven mediante la API de devoluciones de Culqi en su entorno de prueba; los pagos con QR, PagoEfectivo o Cuotéalo no admiten devolución automática y se gestionan por correo. En el simulador la devolución también es simulada. Ninguna operación de este entorno mueve dinero real.</p>
    <h2 className="text-lg font-semibold">Referidos</h2>
    <p>Si tu empresa se registró con el código de otra, esta recibe 31 días adicionales cuando confirmes tu primer pago. Si ese pago se reembolsa, los días otorgados se descuentan.</p>
    <h2 className="text-lg font-semibold">Reclamos</h2>
    <p>Para cualquier disconformidad con una compra o con la atención, usa el <Link href="/libro-reclamaciones" className="text-brand">Libro de Reclamaciones</Link>. La garantía de reembolso no limita tu derecho a reclamar.</p>
    <h2 className="text-lg font-semibold">Datos y constancias</h2>
    <p>Se guardan el nombre, correo y teléfono del comprador, el DNI o RUC y la razón social que indique, el plan, importe, aceptación de estas condiciones y referencias y estados de la operación para mostrar su historial. Los datos de tarjeta se ingresan directamente en el formulario de Culqi y no se almacenan en Compa. El historial pertenece a la empresa de la sesión; solo sus administradores pueden iniciar compras.</p>
    <p>Cada pago confirmado genera una representación de boleta o factura que desglosa el IGV. Es una demostración sin valor tributario: no se envía a la SUNAT. Para revisar una operación, conserva su referencia y consulta con quien administra esta instalación de Compa. El tratamiento de tus datos se describe en la <Link href="/privacidad" className="text-brand">política de privacidad</Link> y el uso del servicio en los <Link href="/terminos" className="text-brand">términos</Link>.</p>
  </article>;
}
