import { NextResponse } from "next/server";
import { getSession, type Session } from "./auth";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Devuelve la sesión o una respuesta 401 lista para retornar. */
export async function apiSession(): Promise<{ session: Session } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: json({ error: "No autenticado" }, 401) };
  return { session };
}
