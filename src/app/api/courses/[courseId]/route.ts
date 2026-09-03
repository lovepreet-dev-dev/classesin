import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params; const { supabase, user } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: course, error } = await supabase.from("courses").select("*, profiles!courses_instructor_id_fkey(full_name), lessons(id,title,content,position)").eq("id", courseId).single();
  if (error || !course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  return NextResponse.json({ ...course, lessons: [...(course.lessons ?? [])].sort((a, b) => a.position - b.position) });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params; const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "instructor")) return NextResponse.json({ error: "Instructor access required" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const changes: Record<string, string> = {};
  if (typeof body.title === "string" && body.title.trim()) changes.title = body.title.trim();
  if (typeof body.description === "string") changes.description = body.description.trim();
  if (typeof body.category === "string" && body.category.trim()) changes.category = body.category.trim();
  if (!Object.keys(changes).length) return NextResponse.json({ error: "Provide a title, description, or category to update" }, { status: 400 });
  changes.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("courses").update(changes).eq("id", courseId).select().single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Course not found" }, { status: error ? 400 : 404 });
  await supabase.from("course_activity_log").insert({ course_id: courseId, actor_id: user.id, event: "edited", message: "Course details updated", metadata: { fields: Object.keys(changes).filter((field) => field !== "updated_at") } });
  return NextResponse.json(data);
}
