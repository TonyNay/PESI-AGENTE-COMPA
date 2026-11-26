import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { writeAudit } from "./audit";
import { getDb } from "./db";

/**
 * Libro de Reclamaciones virtual (Código de Protección y Defensa del Consumidor, art. 150;
 * D. S. 011-2011-PCM y su modificación por el D. S. 101-2022-PCM; Ley 31435).
 * - Reclamo: disconformidad con el servicio contratado.
 * - Queja: malestar por la atención, no relacionado con el servicio.
 * El proveedor responde en un plazo máximo e improrrogable de 15 días hábiles.
 */
export const RESPONSE_BUSINESS_DAYS = 15;
export type ComplaintKind = "reclamo" | "queja";
export type ComplaintStatus = "recibido" | "respondido";

export interface Complaint {
  id: number; code: string; kind: ComplaintKind; status: ComplaintStatus;
  consumerName: string; documentType: string; documentNumber: string; address: string; phone: string; email: string;
  minor: boolean; guardianName: string | null;
  itemType: "producto" | "servicio"; itemDescription: string; amount: number | null;
  detail: string; request: string; responseChannel: "email" | "domicilio";
  createdAt: number; dueAt: number; response: string | null; respondedAt: number | null; respondedBy: string | null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE, year INTEGER NOT NULL, seq INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('reclamo','queja')),
  status TEXT NOT NULL DEFAULT 'recibido' CHECK (status IN ('recibido','respondido')),
  consumer_name TEXT NOT NULL, document_type TEXT NOT NULL, document_number TEXT NOT NULL,
  address TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL,
  minor INTEGER NOT NULL DEFAULT 0, guardian_name TEXT,
  item_type TEXT NOT NULL, item_description TEXT NOT NULL, amount INTEGER,
  detail TEXT NOT NULL, request TEXT NOT NULL, response_channel TEXT NOT NULL,
  company_id INTEGER, ip TEXT,
  created_at INTEGER NOT NULL, due_at INTEGER NOT NULL,
  response TEXT, responded_at INTEGER, responded_by TEXT,
  UNIQUE(year, seq)
);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status, due_at);
`;
const prepared = new WeakSet<DatabaseSync>();
export function ensureComplaintSchema(db: DatabaseSync) {
  if (prepared.has(db)) return;
  db.exec(SCHEMA);
  prepared.add(db);
}

export class ComplaintError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

// ---- Plazo en días hábiles (hora de Lima) ----
const LIMA_OFFSET = -5 * 3_600_000;
const limaDate = (ms: number) => new Date(ms + LIMA_OFFSET); // usar getUTC* sobre esta fecha
function easterSunday(year: number) {
  // Algoritmo anónimo gregoriano (Meeus/Jones/Butcher).
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day);
}
/** Feriados nacionales del Perú (fijos) más Jueves y Viernes Santo. */
export function peruHolidays(year: number): Set<string> {
  const fixed = ["01-01", "05-01", "06-07", "06-29", "07-23", "07-28", "07-29", "08-06", "08-30", "10-08", "11-01", "12-08", "12-09", "12-25"];
  const set = new Set(fixed.map((d) => `${year}-${d}`));
  const easter = easterSunday(year);
  for (const offset of [-3, -2]) set.add(new Date(easter + offset * 86_400_000).toISOString().slice(0, 10));
  return set;
}
/** Suma días hábiles (sin sábados, domingos ni feriados). El plazo vence al final del último día hábil. */
export function addBusinessDays(fromMs: number, days: number): number {
  const d = limaDate(fromMs);
  let cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  let left = days;
  while (left > 0) {
    cursor += 86_400_000;
    const c = new Date(cursor);
    const weekday = c.getUTCDay();
    if (weekday === 0 || weekday === 6 || peruHolidays(c.getUTCFullYear()).has(c.toISOString().slice(0, 10))) continue;
    left--;
  }
  return cursor + 86_400_000 - 1 - LIMA_OFFSET; // 23:59:59.999 hora de Lima
}

// ---- Validación ----
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const complaintSchema = z.object({
  kind: z.enum(["reclamo", "queja"]),
  consumerName: text(3, 120),
  documentType: z.enum(["DNI", "CE", "Pasaporte", "RUC"]),
  documentNumber: z.string().trim().regex(/^[A-Za-z0-9]{6,15}$/),
  address: text(5, 200),
  phone: z.string().trim().transform((v) => v.replace(/[\s()-]/g, "")).pipe(z.string().regex(/^\+?\d{6,15}$/)),
  email: z.email().max(120),
  minor: z.boolean().default(false),
  guardianName: z.string().trim().max(120).optional().default(""),
  itemType: z.enum(["producto", "servicio"]),
  itemDescription: text(3, 300),
  amount: z.union([z.number(), z.string()]).optional().transform((v) => {
    if (v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? Math.round(n * 100) : NaN;
  }).refine((v) => v === null || Number.isFinite(v)),
  detail: text(10, 3000),
  request: text(5, 1500),
  responseChannel: z.enum(["email", "domicilio"]),
  acceptedPrivacy: z.literal(true),
}).superRefine((v, ctx) => {
  if (v.documentType === "DNI" && !/^\d{8}$/.test(v.documentNumber)) ctx.addIssue({ code: "custom", message: "El DNI debe tener 8 dígitos.", path: ["documentNumber"] });
  if (v.minor && v.guardianName.length < 3) ctx.addIssue({ code: "custom", message: "Indica el nombre del padre, madre o apoderado.", path: ["guardianName"] });
});

interface Row {
  id: number; code: string; kind: ComplaintKind; status: ComplaintStatus; consumer_name: string; document_type: string; document_number: string;
  address: string; phone: string; email: string; minor: number; guardian_name: string | null; item_type: "producto" | "servicio";
  item_description: string; amount: number | null; detail: string; request: string; response_channel: "email" | "domicilio";
  created_at: number; due_at: number; response: string | null; responded_at: number | null; responded_by: string | null;
}
const toComplaint = (r: Row): Complaint => ({
  id: r.id, code: r.code, kind: r.kind, status: r.status, consumerName: r.consumer_name, documentType: r.document_type,
  documentNumber: r.document_number, address: r.address, phone: r.phone, email: r.email, minor: !!r.minor, guardianName: r.guardian_name,
  itemType: r.item_type, itemDescription: r.item_description, amount: r.amount, detail: r.detail, request: r.request,
  responseChannel: r.response_channel, createdAt: r.created_at, dueAt: r.due_at, response: r.response,
  respondedAt: r.responded_at, respondedBy: r.responded_by,
});

export function createComplaint(input: unknown, meta: { companyId?: number | null; userId?: number | null; ip?: string | null } = {}, db: DatabaseSync = getDb(), now = Date.now()): Complaint {
  ensureComplaintSchema(db);
  const parsed = complaintSchema.safeParse(input);
  if (!parsed.success) {
    const custom = parsed.error.issues.find((i) => i.code === "custom");
    throw new ComplaintError(custom?.message ?? "Revisa los datos obligatorios de la hoja de reclamación.");
  }
  const v = parsed.data;
  const year = limaDate(now).getUTCFullYear();
  db.exec("BEGIN IMMEDIATE");
  try {
    const seq = Number((db.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM complaints WHERE year = ?").get(year) as { n: number }).n);
    const code = `${String(seq).padStart(6, "0")}-${year}`;
    const id = Number(db.prepare(`INSERT INTO complaints
      (code, year, seq, kind, consumer_name, document_type, document_number, address, phone, email, minor, guardian_name,
       item_type, item_description, amount, detail, request, response_channel, company_id, ip, created_at, due_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      code, year, seq, v.kind, v.consumerName, v.documentType, v.documentNumber.toUpperCase(), v.address, v.phone, v.email.toLowerCase(),
      v.minor ? 1 : 0, v.minor ? v.guardianName : null, v.itemType, v.itemDescription, v.amount, v.detail, v.request, v.responseChannel,
      meta.companyId ?? null, meta.ip?.slice(0, 64) ?? null, now, addBusinessDays(now, RESPONSE_BUSINESS_DAYS)).lastInsertRowid);
    writeAudit(db, { action: "complaint.created", companyId: meta.companyId ?? null, userId: meta.userId ?? null, detail: `Hoja N.º ${code} (${v.kind})`, ip: meta.ip });
    db.exec("COMMIT");
    return toComplaint(db.prepare("SELECT * FROM complaints WHERE id = ?").get(id) as unknown as Row);
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}

/** El consumidor consulta su hoja con el número y su documento (evita enumerar hojas ajenas). */
export function findComplaint(code: string, documentNumber: string, db: DatabaseSync = getDb()): Complaint | null {
  ensureComplaintSchema(db);
  const r = db.prepare("SELECT * FROM complaints WHERE code = ? AND document_number = ?").get(String(code).trim(), String(documentNumber).trim().toUpperCase());
  return r ? toComplaint({ ...r } as unknown as Row) : null;
}

export function listComplaints(db: DatabaseSync = getDb()): Complaint[] {
  ensureComplaintSchema(db);
  return db.prepare("SELECT * FROM complaints ORDER BY status = 'respondido', due_at, id DESC LIMIT 300").all().map((r) => toComplaint({ ...r } as unknown as Row));
}

export function answerComplaint(id: number, response: unknown, admin: { name: string; email: string }, db: DatabaseSync = getDb(), now = Date.now()): Complaint {
  ensureComplaintSchema(db);
  const answer = String(response ?? "").trim();
  if (answer.length < 10 || answer.length > 3000) throw new ComplaintError("Escribe una respuesta de 10 a 3000 caracteres.");
  const current = db.prepare("SELECT * FROM complaints WHERE id = ?").get(id) as unknown as Row | undefined;
  if (!current) throw new ComplaintError("Hoja de reclamación no encontrada.", 404);
  if (current.status === "respondido") throw new ComplaintError("Esta hoja ya fue respondida.", 409);
  db.prepare("UPDATE complaints SET status = 'respondido', response = ?, responded_at = ?, responded_by = ? WHERE id = ? AND status = 'recibido'")
    .run(answer, now, `${admin.name} <${admin.email}>`, id);
  writeAudit(db, { action: "complaint.answered", detail: `Hoja N.º ${current.code}${now > current.due_at ? " · fuera de plazo" : ""}` });
  return toComplaint(db.prepare("SELECT * FROM complaints WHERE id = ?").get(id) as unknown as Row);
}

export interface ComplaintStats { total: number; open: number; overdue: number; answeredOnTime: number; answered: number }
export function complaintStats(db: DatabaseSync = getDb(), now = Date.now()): ComplaintStats {
  ensureComplaintSchema(db);
  const r = db.prepare(`SELECT COUNT(*) AS total,
      SUM(status = 'recibido') AS open,
      SUM(status = 'recibido' AND due_at < ?) AS overdue,
      SUM(status = 'respondido') AS answered,
      SUM(status = 'respondido' AND responded_at <= due_at) AS answeredOnTime
    FROM complaints`).get(now) as Record<string, number | null>;
  return { total: r.total ?? 0, open: r.open ?? 0, overdue: r.overdue ?? 0, answered: r.answered ?? 0, answeredOnTime: r.answeredOnTime ?? 0 };
}
