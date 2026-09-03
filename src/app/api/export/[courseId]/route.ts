import { NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params; const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "instructor")) return NextResponse.json({ error: "Instructor access required" }, { status: 403 });
  const { data: course } = await supabase.from("courses").select("id").eq("id", courseId).maybeSingle();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  const { data, error } = await supabase.from("enrollments").select("progress,enrolled_at,last_progress_at,profiles!enrollments_learner_id_fkey(full_name,email)").eq("course_id", courseId).order("enrolled_at"); if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = ["learner,email,progress,enrolled_at,last_progress_at", ...(data ?? []).map((row) => { const learner = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles; return [learner?.full_name, learner?.email, row.progress, row.enrolled_at, row.last_progress_at].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","); })]; return new NextResponse(rows.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="course-${courseId}-progress.csv"` } });
}
