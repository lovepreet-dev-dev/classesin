import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/db-errors";

export async function POST(request: NextRequest, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params;
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "instructor")) return NextResponse.json({ error: "Instructor access required" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const lessonIds: string[] = Array.isArray(body.lessonIds) ? body.lessonIds.filter((id: unknown): id is string => typeof id === "string") : [];
  if (!lessonIds.length) return NextResponse.json({ error: "lessonIds must be a non-empty list of unique IDs" }, { status: 400 });

  const { error } = await supabase.rpc("reorder_lessons", { p_course_id: courseId, p_lesson_ids: lessonIds });
  if (error) return dbErrorResponse(error);
  return NextResponse.json({ courseId, lessonIds });
}
