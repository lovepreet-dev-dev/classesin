import { NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";
import { getDashboard } from "@/lib/queries";

export async function GET() {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "instructor")) return NextResponse.json({ error: "Instructor access required" }, { status: 403 });
  const { data, error } = await getDashboard(supabase);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data);
}
