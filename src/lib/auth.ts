import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get, run } from "./db";
import type { Company, User } from "./types";

export const SESSION_COOKIE = "compa_session";
const SESSION_DAYS = 14;

/** El registro público está cerrado salvo que COMPA_ALLOW_REGISTER=1 (evita que cualquiera gaste tokens). */
export const registrationOpen = () => process.env.COMPA_ALLOW_REGISTER === "1";

// Límite de intentos fallidos de login por IP (en memoria; suficiente para una sola instancia).
const LOGIN_MAX_FAILS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFails = new Map<string, { count: number; resetAt: number }>();

export function loginBlocked(key: string): boolean {
  const e = loginFails.get(key);
  if (!e) return false;
  if (Date.now() > e.resetAt) { loginFails.delete(key); return false; }
  return e.count >= LOGIN_MAX_FAILS;
}

export function recordLoginFail(key: string) {
  const e = loginFails.get(key);
  if (!e || Date.now() > e.resetAt) loginFails.set(key, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
  else e.count++;
}

export const clearLoginFails = (key: string) => loginFails.delete(key);

export function createCompanyAndUser(input: {
  companyName: string; taxId?: string; industry?: string; country?: string; currency?: string;
  name: string; email: string; password: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (get("SELECT id FROM users WHERE email = ?", email)) throw new Error("Ya existe una cuenta con ese correo.");
  const c = run(
    "INSERT INTO companies (name, tax_id, industry, country, currency) VALUES (?,?,?,?,?)",
    input.companyName.trim(), input.taxId?.trim() || null, input.industry?.trim() || null,
    input.country?.trim() || "Perú", input.currency?.trim() || "PEN"
  );
  const hash = bcrypt.hashSync(input.password, 10);
  const u = run(
    "INSERT INTO users (company_id, email, password_hash, name, role) VALUES (?,?,?,?, 'admin')",
    c.lastInsertRowid, email, hash, input.name.trim()
  );
  return { companyId: c.lastInsertRowid, userId: u.lastInsertRowid };
}

export function verifyLogin(email: string, password: string): number | null {
  const u = get<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = ?", email.trim().toLowerCase()
  );
  if (!u || !bcrypt.compareSync(password, u.password_hash)) return null;
  return u.id;
}

export function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)", token, userId, expires.toISOString());
  return { token, expires };
}

export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", expires,
    secure: process.env.NODE_ENV === "production" && process.env.COMPA_INSECURE_COOKIES !== "1",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) run("DELETE FROM sessions WHERE token = ?", token);
  jar.delete(SESSION_COOKIE);
}

export type Session = { user: User; company: Company };

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = get<User & { expires_at: string }>(
    `SELECT u.id, u.company_id, u.email, u.name, u.role, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`, token
  );
  if (!row || new Date(row.expires_at) < new Date()) return null;
  const company = get<Company>("SELECT id, name, tax_id, industry, country, currency FROM companies WHERE id = ?", row.company_id);
  if (!company) return null;
  const { expires_at: _e, ...user } = row;
  void _e;
  return { user, company };
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
