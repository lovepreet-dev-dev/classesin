import { NextResponse } from "next/server";

type DbError = { code?: string; message: string; details?: string | null };

export function dbErrorStatus(error: DbError) {
  if (error.code && /^KN\d{3}$/.test(error.code)) return Number(error.code.slice(2));
  if (error.code === "22000" || error.code === "23505") return 409;
  if (error.code === "42501") return 403;
  return 400;
}

export function dbErrorResponse(error: DbError) {
  const code = error.code?.startsWith("KN") && error.details ? { code: error.details } : {};
  return NextResponse.json({ error: error.message, ...code }, { status: dbErrorStatus(error) });
}
