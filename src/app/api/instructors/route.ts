import { NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";

export async function GET() {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "instructor")) return NextResponse.json({ error: "Instructor access required" }, { status: 403 });
  const { data, error } = await supabase.from("profiles").select("id,full_name").eq("role", "instructor").order("full_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ instructors: data ?? [] });
}
