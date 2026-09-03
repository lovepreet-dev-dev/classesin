import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";

export async function POST(request: NextRequest, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params;
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "instructor")) return NextResponse.json({ error: "Instructor access required" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const lessonIds: string[] = Array.isArray(body.lessonIds) ? body.lessonIds.filter((id: unknown): id is string => typeof id === "string") : [];
  if (!lessonIds.length || new Set(lessonIds).size !== lessonIds.length) return NextResponse.json({ error: "lessonIds must be a non-empty list of unique IDs" }, { status: 400 });

  const { data: lessons, error: readError } = await supabase.from("lessons").select("id,position").eq("course_id", courseId);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 });
  const current = lessons ?? [];
  if (current.length !== lessonIds.length || lessonIds.some((id) => !current.some((lesson) => lesson.id === id))) return NextResponse.json({ error: "The reorder list must contain every lesson in this course" }, { status: 400 });

  // Move to a collision-free range first, then assign the requested contiguous positions.
  const offset = current.reduce((max, lesson) => Math.max(max, lesson.position), 0) + current.length + 1;
  for (const [index, id] of lessonIds.entries()) {
    const { error } = await supabase.from("lessons").update({ position: offset + index }).eq("id", id).eq("course_id", courseId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  for (const [index, id] of lessonIds.entries()) {
    const { error } = await supabase.from("lessons").update({ position: index + 1, updated_at: new Date().toISOString() }).eq("id", id).eq("course_id", courseId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await supabase.from("courses").update({ updated_at: new Date().toISOString() }).eq("id", courseId);
  await supabase.from("course_activity_log").insert({ course_id: courseId, actor_id: user.id, event: "edited", message: "Lesson order updated", metadata: { lesson_ids: lessonIds } });
  return NextResponse.json({ courseId, lessonIds });
}
