import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/** Se resuelve al abrir la base (no al importar el módulo): las pruebas fijan COMPA_DB_PATH antes de usarla. */
const dbPath = () => process.env.COMPA_DB_PATH || path.join(process.cwd(), "data", "compa.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tax_id TEXT,
  industry TEXT,
  country TEXT NOT NULL DEFAULT 'Perú',
  currency TEXT NOT NULL DEFAULT 'PEN',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'producto' CHECK (type IN ('producto','servicio')),
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  description TEXT,
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PEN',
  sku TEXT,
  url TEXT,
  keywords TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  provider TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT,
  error TEXT,
  result_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_analyses_company ON analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_analyses_product ON analyses(product_id);
CREATE TABLE IF NOT EXISTS competitor_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id INTEGER NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  competitor TEXT NOT NULL,
  product_title TEXT,
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PEN',
  url TEXT,
  rating REAL,
  availability TEXT,
  features TEXT,
  match_score REAL,
  scraped_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_offers_analysis ON competitor_offers(analysis_id);
CREATE TABLE IF NOT EXISTS agent_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id INTEGER NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  step TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_analysis ON agent_logs(analysis_id);
CREATE TABLE IF NOT EXISTS strategic_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subject_kind TEXT NOT NULL DEFAULT 'propia' CHECK (subject_kind IN ('propia','externa')),
  subject_name TEXT NOT NULL,
  website_url TEXT,
  industry TEXT,
  country TEXT,
  notes TEXT,
  doc_name TEXT,
  doc_text TEXT,
  doc_path TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  provider TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT,
  error TEXT,
  result_json TEXT,
  modules TEXT
);
CREATE INDEX IF NOT EXISTS idx_strategic_company ON strategic_analyses(company_id);
CREATE TABLE IF NOT EXISTS strategic_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategic_id INTEGER NOT NULL REFERENCES strategic_analyses(id) ON DELETE CASCADE,
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  step TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_strategic_logs ON strategic_logs(strategic_id);
CREATE TABLE IF NOT EXISTS strategic_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategic_id INTEGER NOT NULL REFERENCES strategic_analyses(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('institucional','referencia')),
  name TEXT NOT NULL,
  path TEXT,
  text_content TEXT,
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_strategic_documents ON strategic_documents(strategic_id);
CREATE TABLE IF NOT EXISTS user_recovery_codes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  PRIMARY KEY (user_id, code_hash)
);
CREATE TABLE IF NOT EXISTS legal_consents (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, version)
);
`;

/** Columnas agregadas después de crear la tabla en bases existentes. */
function migrate(db: DatabaseSync) {
  const add = (table: string, column: string, type = "TEXT") => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => String(c.name));
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  };
  add("strategic_analyses", "modules");
  add("competitor_offers", "anomaly");
  add("users", "totp_secret");
  add("users", "totp_enabled_at");
  add("users", "totp_last_step", "INTEGER");
  for (const table of ["analyses", "strategic_analyses"]) { add(table, "reviewed_by"); add(table, "reviewed_at"); }
}

type G = typeof globalThis & { __compaDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  const g = globalThis as G;
  if (g.__compaDb) return g.__compaDb;
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  migrate(db);
  g.__compaDb = db;
  return db;
}

/** Marca análisis huérfanos (queued/running) como fallidos. Se llama al arrancar el servidor. */
export function failOrphanAnalyses(): number {
  const db = getDb();
  let n = 0;
  for (const table of ["analyses", "strategic_analyses"]) {
    const r = db
      .prepare(
        `UPDATE ${table} SET status='failed', finished_at=datetime('now'),
         error='Interrumpido: el servidor se reinició mientras el análisis estaba en curso.'
         WHERE status IN ('queued','running')`
      )
      .run();
    n += Number(r.changes);
  }
  return n;
}

export function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...(params as never[])).map((r) => ({ ...r })) as T[];
}
export function get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  const r = getDb().prepare(sql).get(...(params as never[]));
  return r ? ({ ...r } as T) : undefined; // node:sqlite devuelve objetos sin prototipo
}
export function run(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number } {
  const r = getDb().prepare(sql).run(...(params as never[]));
  return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
}
