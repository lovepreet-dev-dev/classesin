import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";

async function instructorContext() {
  const context = await getAuthContext();
  if (!context.user) return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }), context };
  if (!hasRole(context.profile, "instructor")) return { response: NextResponse.json({ error: "Instructor access required" }, { status: 403 }), context };
  return { response: null, context };
}

export async function POST(request: NextRequest, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params; const auth = await instructorContext();
  if (auth.response) return auth.response;
  const { supabase, user } = auth.context;
  const body = await request.json().catch(() => ({}));
  if (!body.title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const { data: course } = await supabase.from("courses").select("id").eq("id", courseId).maybeSingle();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  const { data: existing } = await supabase.from("lessons").select("position").eq("course_id", courseId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from("lessons").insert({ course_id: courseId, title: body.title.trim(), content: String(body.content ?? "").trim(), position: Number(existing?.position ?? 0) + 1 }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabase.from("courses").update({ updated_at: new Date().toISOString() }).eq("id", courseId);
  await supabase.from("course_activity_log").insert({ course_id: courseId, actor_id: user!.id, event: "edited", message: "Lesson added", metadata: { lesson_id: data.id } });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params; const auth = await instructorContext();
  if (auth.response) return auth.response;
  const { supabase, user } = auth.context; const body = await request.json().catch(() => ({})); const lessonId = String(body.lessonId ?? "");
  if (!lessonId) return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
  const changes: Record<string, string> = {};
  if (typeof body.title === "string" && body.title.trim()) changes.title = body.title.trim();
  if (typeof body.content === "string") changes.content = body.content.trim();
  if (!Object.keys(changes).length) return NextResponse.json({ error: "Provide a title or content to update" }, { status: 400 });
  changes.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("lessons").update(changes).eq("id", lessonId).eq("course_id", courseId).select().single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Lesson not found" }, { status: error ? 400 : 404 });
  await supabase.from("courses").update({ updated_at: new Date().toISOString() }).eq("id", courseId);
  await supabase.from("course_activity_log").insert({ course_id: courseId, actor_id: user!.id, event: "edited", message: "Lesson updated", metadata: { lesson_id: lessonId } });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params; const auth = await instructorContext();
  if (auth.response) return auth.response;
  const { supabase, user } = auth.context; const lessonId = request.nextUrl.searchParams.get("lessonId") ?? "";
  if (!lessonId) return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
  const { data: lesson } = await supabase.from("lessons").select("id").eq("id", lessonId).eq("course_id", courseId).maybeSingle();
  if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId).eq("course_id", courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { data: remaining } = await supabase.from("lessons").select("id,position").eq("course_id", courseId).order("position");
  const offset = (remaining ?? []).length + 100;
  for (const [index, row] of (remaining ?? []).entries()) await supabase.from("lessons").update({ position: offset + index }).eq("id", row.id);
  for (const [index, row] of (remaining ?? []).entries()) await supabase.from("lessons").update({ position: index + 1, updated_at: new Date().toISOString() }).eq("id", row.id);
  await supabase.from("courses").update({ updated_at: new Date().toISOString() }).eq("id", courseId);
  await supabase.from("course_activity_log").insert({ course_id: courseId, actor_id: user!.id, event: "edited", message: "Lesson removed", metadata: { lesson_id: lessonId } });
  return NextResponse.json({ courseId, lessonId });
}
