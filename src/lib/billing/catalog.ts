/** Contrato público de pagos. Este módulo se comparte con el navegador y no lee secretos. */
export const BILLING_TERMS_VERSION = "2026-11-25";
/** Garantía de satisfacción: reembolso total dentro de este plazo si el uso del plan fue bajo. */
export const REFUND_WINDOW_DAYS = 7;
/** Máximo de análisis (de precios y estratégicos) usados desde la compra para que proceda el reembolso. */
export const REFUND_MAX_ANALYSES = 5;
/** Días antes del vencimiento en que se avisa para renovar. */
export const RENEWAL_NOTICE_DAYS = 5;
export const BILLING_PLANS = [
  {
    id: "emprendedor", name: "Emprendedor", amount: 2990, days: 31,
    description: "Para empezar a comparar tu catálogo con el mercado.",
    priceAnalyses: 20, strategicAnalyses: 2, products: 50,
    features: ["20 análisis de precios por mes", "2 análisis estratégicos por mes", "Catálogo de hasta 50 productos y servicios", "Comparación de precios, fuentes y exportación CSV/PDF"],
  },
  {
    id: "pro", name: "Pro", amount: 7990, days: 31,
    description: "Para negocios que revisan su posición y estrategia con frecuencia.",
    priceAnalyses: 100, strategicAnalyses: 10, products: 250,
    features: ["100 análisis de precios por mes", "10 análisis estratégicos por mes", "Catálogo de hasta 250 productos y servicios", "FODA, PESTEL, Porter, matrices EFI/EFE y objetivos con KPI"],
    highlighted: true,
  },
  {
    id: "empresa", name: "Empresa", amount: 14990, days: 31,
    description: "Para evaluar un catálogo amplio y varias decisiones de negocio.",
    priceAnalyses: 300, strategicAnalyses: 30, products: 1000,
    features: ["300 análisis de precios por mes", "30 análisis estratégicos por mes", "Catálogo de hasta 1 000 productos y servicios", "Canvas, cadena de valor, BCG, Ansoff e informes ejecutivos"],
  },
] as const;

export type BillingPlanId = typeof BILLING_PLANS[number]["id"];
export interface PlanLimits { name: string; priceAnalyses: number; strategicAnalyses: number; products: number }
/** Sin plan vigente rige esta prueba gratuita. */
export const FREE_PLAN: PlanLimits = { name: "Prueba gratuita", priceAnalyses: 5, strategicAnalyses: 1, products: 20 };

/** Los precios del catálogo incluyen IGV. Importes en céntimos. */
export const IGV_RATE = 0.18;
export function igvBreakdown(total: number) {
  const base = Math.round(total / (1 + IGV_RATE));
  return { base, igv: total - base, total };
}

/** Comprueba el dígito verificador del RUC (módulo 11). */
export function isValidRuc(ruc: string) {
  if (!/^(10|15|16|17|20)\d{9}$/.test(ruc)) return false;
  const sum = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((total, weight, i) => total + weight * Number(ruc[i]), 0);
  return (11 - (sum % 11)) % 10 === Number(ruc[10]);
}
export type InvoiceType = "boleta" | "factura";
/** DNI vacío: una boleta menor a S/ 700 no exige identificar al cliente. */
export interface BillingInvoice { type: InvoiceType; documentNumber: string; legalName: string }
export interface ReceiptSummary { number: string; type: InvoiceType }
/** Nota de crédito electrónica que anula el comprobante de una compra reembolsada. */
export interface CreditNote { number: string; reference: string; reason: string; base: number; igv: number; total: number; issuedAt: number }
export interface Receipt extends ReceiptSummary {
  paymentId: string; customerName: string; documentNumber: string | null;
  base: number; igv: number; total: number; planName: string; method: string; mode: PaymentMode; issuedAt: number;
  creditNote: CreditNote | null;
}
export type PaymentProvider = "culqi" | "demo";
export type PaymentMode = "TEST" | "SIMULATED";
export type PaymentState = "creating" | "pending" | "paid" | "failed" | "expired" | "cancelled" | "refunded";
export const findBillingPlan = (id: string) => BILLING_PLANS.find((p) => p.id === id);
export const soles = (cents: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(cents / 100);

export interface BillingBuyer { firstName: string; lastName: string; email: string; phone: string }
export interface PaymentSummary {
  id: string;
  planId: BillingPlanId;
  planName: string;
  amount: number;
  currency: "PEN";
  provider: PaymentProvider;
  mode: PaymentMode;
  status: PaymentState;
  method: string | null;
  transactionId: string | null;
  message: string | null;
  createdAt: number;
  expiresAt: number;
  paidAt: number | null;
  receipt: ReceiptSummary | null;
  creditNote: { number: string } | null;
  /** Dentro del plazo de la garantía; el servidor valida además el uso del plan. */
  refundable: boolean;
}
export interface Membership {
  mode: PaymentMode;
  planId: BillingPlanId;
  activeUntil: number;
  active: boolean;
}
export interface BillingOverview {
  enabled: boolean;
  simulatorEnabled: boolean;
  configurationMessage: string | null;
  buyer: BillingBuyer;
  invoice: BillingInvoice;
  plan: PlanLimits;
  payments: PaymentSummary[];
  memberships: Membership[];
  usage: { priceAnalyses: number; strategicAnalyses: number; products: number };
  renewal: RenewalNotice | null;
}
/** Aviso para renovar: el plan vence pronto o venció hace poco. No hay cobros automáticos. */
export interface RenewalNotice { planId: BillingPlanId; planName: string; mode: PaymentMode; activeUntil: number; daysLeft: number; state: "expiring" | "expired" }
export interface CulqiCheckoutData {
  publicKey: string;
  orderId: string;
  amount: number;
  currency: "PEN";
  expiresAt: number;
  client: { email: string; firstName: string; lastName: string };
  paymentMethods: Record<string, boolean>;
}
export interface CheckoutResult { payment: PaymentSummary; checkout: CulqiCheckoutData | null }
export interface PaymentEvent { id: number; state: string; message: string; createdAt: number }
export interface PaymentResult {
  paid: boolean;
  requires3DS?: boolean;
  payment: PaymentSummary;
  events?: PaymentEvent[];
}
export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  creating: "Preparando", pending: "Pendiente", paid: "Pagado", failed: "Rechazado", expired: "Vencido", cancelled: "Cancelado", refunded: "Reembolsado",
};
