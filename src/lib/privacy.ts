const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
/** Celular peruano de 9 dígitos, con o sin prefijo +51 y separadores. */
const PHONE = /(?<!\d|\d[.,])(?:\+?51[\s-]?)?9\d{2}[\s-]?\d{3}[\s-]?\d{3}(?!\d|[.,]\d)/g;
/** Un DNI solo se reconoce con su etiqueta: ocho dígitos sueltos pueden ser una cifra de ventas. */
const DNI = /\bDNI\b\s*(?:N[.°º]*\s*)?:?\s*\d{8}\b/gi;

/** Minimización antes de enviar texto libre al proveedor de IA. Un PDF se envía tal cual: la interfaz lo advierte. */
export function redactPersonalData(text: string): string {
  return text.replace(EMAIL, "[correo omitido]").replace(DNI, "[DNI omitido]").replace(PHONE, "[teléfono omitido]");
}
