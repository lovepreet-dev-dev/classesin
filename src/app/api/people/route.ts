import { NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";

export async function GET() {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "instructor")) return NextResponse.json({ error: "Instructor access required" }, { status: 403 });
  const { data, error } = await supabase.from("profiles").select("id,full_name,email,enrollments:enrollments!enrollments_learner_id_fkey(progress,last_progress_at)").eq("role", "learner").order("full_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const people = (data ?? []).map((item) => {
    const enrollments = item.enrollments ?? [];
    const progress = enrollments.some((row) => row.progress === "in_progress") ? "in_progress" : enrollments.some((row) => row.progress === "not_started") ? "not_started" : enrollments.some((row) => row.progress === "completed") ? "completed" : "not_started";
    const latest = enrollments.map((row) => row.last_progress_at).filter(Boolean).sort().at(-1) ?? null;
    return { id: item.id, full_name: item.full_name, email: item.email, courses: enrollments.length, progress, last_active: latest };
  });
  return NextResponse.json({ people });
}
