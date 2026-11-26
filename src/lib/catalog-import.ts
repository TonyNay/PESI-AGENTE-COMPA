import type { ProductInput } from "./products";

/**
 * Importación del catálogo desde la plantilla de Compa o desde las exportaciones CSV estándar de
 * Shopify (Productos → Exportar) y WooCommerce (Productos → Exportar). Las tiendas en línea de muchas
 * mipymes ya usan estas plataformas, así que pueden traer su catálogo sin reescribirlo.
 */
export type CatalogFormat = "compa" | "shopify" | "woocommerce";
export const FORMAT_LABEL: Record<CatalogFormat, string> = { compa: "plantilla de Compa", shopify: "Shopify", woocommerce: "WooCommerce" };

const COMPA_ALIASES: Record<string, keyof ProductInput> = {
  tipo: "type", type: "type", nombre: "name", name: "name", producto: "name", marca: "brand", brand: "brand",
  categoria: "category", "categoría": "category", category: "category", descripcion: "description", "descripción": "description",
  description: "description", precio: "price", price: "price", moneda: "currency", currency: "currency", sku: "sku",
  url: "url", palabras_clave: "keywords", keywords: "keywords",
};

const norm = (h: string) => h.replace(/^﻿/, "").trim().toLowerCase();

export function detectFormat(headers: string[]): CatalogFormat | null {
  const h = new Set(headers.map(norm));
  if (h.has("handle") && h.has("title") && (h.has("variant price") || h.has("price"))) return "shopify";
  if (h.has("name") && (h.has("regular price") || h.has("sale price")) && (h.has("type") || h.has("sku"))) return "woocommerce";
  const mapped = headers.map((x) => COMPA_ALIASES[norm(x)]);
  if (mapped.includes("name") && mapped.includes("price")) return "compa";
  return null;
}

/** Texto plano a partir del HTML de la descripción, recortado a un largo razonable. */
export function stripHtml(html: string, max = 500): string {
  const text = html.replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export interface MappedRow { line: number; product: ProductInput }
export interface MappedCatalog { format: CatalogFormat; rows: MappedRow[]; skipped: string[] }

/** Convierte las filas del CSV (incluida la cabecera) en productos de Compa. */
export function mapCatalog(rows: string[][]): MappedCatalog | null {
  if (rows.length < 2) return null;
  const headers = rows[0];
  const format = detectFormat(headers);
  if (!format) return null;
  const index = new Map(headers.map((h, i) => [norm(h), i]));
  const cell = (r: string[], ...names: string[]) => {
    for (const n of names) { const i = index.get(n); if (i !== undefined && (r[i] ?? "").trim()) return (r[i] ?? "").trim(); }
    return "";
  };
  const out: MappedRow[] = [];
  const skipped: string[] = [];

  if (format === "compa") {
    const keys = headers.map((h) => COMPA_ALIASES[norm(h)]);
    rows.slice(1).forEach((r, i) => {
      const product: ProductInput = {};
      keys.forEach((k, j) => { if (k) (product as Record<string, string>)[k] = (r[j] ?? "").trim(); });
      out.push({ line: i + 2, product });
    });
    return { format, rows: out, skipped };
  }

  if (format === "shopify") {
    // Las variantes vienen en filas siguientes con el mismo Handle y sin Title: heredan los datos del producto.
    const parents = new Map<string, { title: string; vendor: string; category: string; body: string; tags: string; status: string; options: string[] }>();
    rows.slice(1).forEach((r, i) => {
      const line = i + 2;
      const handle = cell(r, "handle");
      if (!handle) { skipped.push(`Fila ${line}: sin Handle.`); return; }
      if (cell(r, "title")) parents.set(handle, {
        title: cell(r, "title"), vendor: cell(r, "vendor"), category: cell(r, "product category", "type"),
        body: cell(r, "body (html)", "body html", "description"), tags: cell(r, "tags"), status: cell(r, "status").toLowerCase(),
        options: [cell(r, "option1 name"), cell(r, "option2 name"), cell(r, "option3 name")],
      });
      const parent = parents.get(handle);
      if (!parent) { skipped.push(`Fila ${line}: variante sin producto principal.`); return; }
      if (parent.status === "archived") { skipped.push(`Fila ${line}: "${parent.title}" está archivado.`); return; }
      const price = cell(r, "variant price", "price");
      // Filas solo de imagen: tienen Handle pero ni título ni precio; se ignoran sin aviso.
      if (!price) { if (cell(r, "title")) skipped.push(`Fila ${line}: "${parent.title}" sin precio.`); return; }
      const values = [cell(r, "option1 value"), cell(r, "option2 value"), cell(r, "option3 value")].filter((v) => v && v.toLowerCase() !== "default title");
      out.push({ line, product: {
        type: "producto", name: values.length ? `${parent.title} - ${values.join(" / ")}` : parent.title, brand: parent.vendor,
        category: parent.category.split(">").at(-1)?.trim() ?? "", description: stripHtml(parent.body), price, sku: cell(r, "variant sku", "sku"), keywords: parent.tags,
      } });
    });
    return { format, rows: out, skipped };
  }

  // WooCommerce: los productos "variable" no tienen precio; se importan sus variaciones.
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const type = cell(r, "type").toLowerCase();
    const name = cell(r, "name");
    if (type.includes("variable") && !type.includes("variation")) { skipped.push(`Fila ${line}: "${name}" es variable; se importan sus variaciones.`); return; }
    if (type.includes("grouped") || type.includes("external")) { skipped.push(`Fila ${line}: "${name}" es un producto ${type}.`); return; }
    if (cell(r, "published") === "-1") { skipped.push(`Fila ${line}: "${name}" es un borrador.`); return; }
    const price = cell(r, "sale price") || cell(r, "regular price");
    if (!name || !price) { skipped.push(`Fila ${line}: sin nombre o precio.`); return; }
    out.push({ line, product: {
      type: type.includes("virtual") || type.includes("service") ? "servicio" : "producto", name,
      brand: cell(r, "brands", "brand"),
      category: (cell(r, "categories").split(",")[0] ?? "").split(">").at(-1)?.trim() ?? "",
      description: stripHtml(cell(r, "short description", "description")), price, sku: cell(r, "sku"), keywords: cell(r, "tags"),
    } });
  });
  return { format, rows: out, skipped };
}
