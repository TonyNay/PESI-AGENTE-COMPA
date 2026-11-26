import { get, run } from "./db";
import type { Product } from "./types";

export type ProductInput = {
  type?: string; name?: string; brand?: string; category?: string; description?: string;
  price?: number | string; currency?: string; sku?: string; url?: string; keywords?: string;
};

export function cleanProduct(i: ProductInput, defaultCurrency: string) {
  const name = (i.name || "").toString().trim();
  if (!name) throw new Error("El nombre es obligatorio.");
  const price = typeof i.price === "number" ? i.price : parseFloat(String(i.price ?? "").replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", "."));
  if (!Number.isFinite(price) || price < 0) throw new Error(`Precio inválido para "${name}".`);
  const type = (i.type || "producto").toString().trim().toLowerCase().startsWith("serv") ? "servicio" : "producto";
  const url = (i.url || "").toString().trim();
  if (url && !/^https?:\/\//i.test(url)) throw new Error(`URL inválida para "${name}" (debe empezar con http:// o https://).`);
  const n = (v?: string) => (v ?? "").toString().trim() || null;
  return {
    type, name, brand: n(i.brand), category: n(i.category), description: n(i.description), price,
    currency: (i.currency || defaultCurrency).toString().trim().toUpperCase() || defaultCurrency,
    sku: n(i.sku), url: url || null, keywords: n(i.keywords),
  };
}

export function insertProduct(companyId: number, p: ReturnType<typeof cleanProduct>): number {
  return run(
    `INSERT INTO products (company_id, type, name, brand, category, description, price, currency, sku, url, keywords)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    companyId, p.type, p.name, p.brand, p.category, p.description, p.price, p.currency, p.sku, p.url, p.keywords
  ).lastInsertRowid;
}

export function updateProduct(companyId: number, id: number, p: ReturnType<typeof cleanProduct>) {
  return run(
    `UPDATE products SET type=?, name=?, brand=?, category=?, description=?, price=?, currency=?, sku=?, url=?, keywords=?
     WHERE id=? AND company_id=?`,
    p.type, p.name, p.brand, p.category, p.description, p.price, p.currency, p.sku, p.url, p.keywords, id, companyId
  ).changes;
}

export const getProduct = (companyId: number, id: number) =>
  get<Product>("SELECT * FROM products WHERE id = ? AND company_id = ?", id, companyId);
