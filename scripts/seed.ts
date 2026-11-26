import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { all, get, getDb, run } from "../src/lib/db";

const DEMO_EMAIL = "demo@compa.pe";
// La contraseña de la cuenta demo NO va en el código (el repo es público): se toma de COMPA_DEMO_PASSWORD.
// Si no está definida se genera una aleatoria y se muestra en los logs.
const DEMO_PASS = process.env.COMPA_DEMO_PASSWORD || crypto.randomBytes(12).toString("base64url");

const ITEMS = [
  { type: "producto", name: "Xiaomi Redmi Note 14 256GB", brand: "Xiaomi", category: "Celulares", description: "Smartphone 6.67\" AMOLED, 256GB de almacenamiento, cámara de 108MP.", price: 749, sku: "XIA-RN14-256", keywords: "redmi note 14, xiaomi, celular 256gb" },
  { type: "producto", name: "Audífonos Sony WH-1000XM5", brand: "Sony", category: "Audio", description: "Audífonos inalámbricos con cancelación de ruido líder en su categoría.", price: 1299, sku: "SON-WH1000XM5", keywords: "sony wh-1000xm5, audifonos bluetooth, cancelacion de ruido" },
  { type: "producto", name: "Freidora de aire Oster 4L", brand: "Oster", category: "Hogar y cocina", description: "Freidora de aire digital de 4 litros.", price: 329, sku: "OST-AF4L", keywords: "freidora de aire oster, air fryer 4l" },
  { type: "producto", name: "Laptop Lenovo IdeaPad Slim 3 Ryzen 5 16GB 512GB", brand: "Lenovo", category: "Computadoras", description: "Laptop 15.6\" AMD Ryzen 5, 16GB RAM, SSD 512GB.", price: 2299, sku: "LEN-IPS3-R5", keywords: "lenovo ideapad slim 3, ryzen 5, laptop 16gb" },
  { type: "producto", name: "Smart TV Samsung 55\" Crystal UHD 4K", brand: "Samsung", category: "Televisores", description: "Smart TV 55 pulgadas Crystal UHD 4K.", price: 1899, sku: "SAM-55CU", keywords: "smart tv samsung 55 crystal uhd 4k" },
  { type: "servicio", name: "Instalación y configuración de Smart TV a domicilio", brand: null, category: "Servicios técnicos", description: "Instalación, montaje en pared y configuración de Smart TV a domicilio.", price: 120, sku: "SRV-INST-TV", keywords: "instalacion smart tv, montaje tv a domicilio" },
];

export function seed() {
  getDb();
  let company = get<{ id: number }>("SELECT c.id FROM companies c JOIN users u ON u.company_id = c.id WHERE u.email = ?", DEMO_EMAIL);
  const newUser = !company;
  if (!company) {
    const c = run("INSERT INTO companies (name, tax_id, industry, country, currency) VALUES (?,?,?,?,?)",
      "Andina Retail SAC", "20601234567", "Retail tecnología y hogar", "Perú", "PEN");
    run("INSERT INTO users (company_id, email, password_hash, name, role) VALUES (?,?,?,?, 'admin')",
      c.lastInsertRowid, DEMO_EMAIL, bcrypt.hashSync(DEMO_PASS, 10), "Cuenta Demo");
    company = { id: c.lastInsertRowid };
    console.log("Empresa y usuario demo creados.");
  } else if (process.env.COMPA_DEMO_PASSWORD) {
    // Mantiene la contraseña sincronizada con la variable de entorno (permite rotarla con un redeploy).
    run("UPDATE users SET password_hash = ? WHERE email = ?", bcrypt.hashSync(DEMO_PASS, 10), DEMO_EMAIL);
  }
  let created = 0;
  for (const it of ITEMS) {
    if (get("SELECT id FROM products WHERE company_id = ? AND name = ?", company.id, it.name)) continue;
    run(`INSERT INTO products (company_id, type, name, brand, category, description, price, currency, sku, keywords) VALUES (?,?,?,?,?,?,?, 'PEN', ?, ?)`,
      company.id, it.type, it.name, it.brand, it.category, it.description, it.price, it.sku, it.keywords);
    created++;
  }
  console.log(`Productos demo: ${created} creados, ${ITEMS.length - created} ya existían.`);

  const file = path.join(process.cwd(), "data", "seed-analyses.json");
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as { analyses: SeedAnalysis[] };
    let imported = 0;
    for (const a of data.analyses) {
      const p = get<{ id: number }>("SELECT id FROM products WHERE company_id = ? AND name = ?", company.id, a.productName);
      if (!p) continue;
      if (get("SELECT id FROM analyses WHERE product_id = ? AND finished_at = ?", p.id, a.finished_at)) continue;
      const r = run(`INSERT INTO analyses (product_id, company_id, status, provider, created_at, started_at, finished_at, error, result_json) VALUES (?,?, 'completed', ?,?,?,?,?,?)`,
        p.id, company.id, a.provider, a.started_at, a.started_at, a.finished_at, null, JSON.stringify(a.result));
      for (const o of a.offers)
        run(`INSERT INTO competitor_offers (analysis_id, competitor, product_title, price, currency, url, rating, availability, features, match_score, scraped_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          r.lastInsertRowid, o.competitor, o.product_title, o.price, o.currency, o.url, o.rating, o.availability, o.features, o.match_score, o.scraped_at);
      for (const l of a.logs ?? [])
        run("INSERT INTO agent_logs (analysis_id, ts, step, level, message) VALUES (?,?,?,?,?)", r.lastInsertRowid, l.ts, l.step, l.level, l.message);
      imported++;
    }
    console.log(`Análisis importados desde seed-analyses.json: ${imported}`);
  }
  if (process.env.COMPA_DEMO_PASSWORD) console.log(`Listo. Cuenta demo: ${DEMO_EMAIL} (contraseña: COMPA_DEMO_PASSWORD)`);
  else if (newUser) console.log(`Listo. Cuenta demo: ${DEMO_EMAIL} / ${DEMO_PASS} (generada; define COMPA_DEMO_PASSWORD para fijarla)`);
  else console.log(`Listo. Cuenta demo: ${DEMO_EMAIL} (contraseña sin cambios; define COMPA_DEMO_PASSWORD para cambiarla)`);
}

type SeedAnalysis = {
  productName: string; provider: string | null; started_at: string; finished_at: string; result: unknown;
  offers: { competitor: string; product_title: string; price: number; currency: string; url: string; rating: number | null; availability: string; features: string; match_score: number; scraped_at: string }[];
  logs?: { ts: string; step: string; level: string; message: string }[];
};

void all;
seed();
