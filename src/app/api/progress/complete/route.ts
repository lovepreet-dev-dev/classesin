import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const lessonId = String(body.lessonId ?? "");
  if (!lessonId) return NextResponse.json({ error: "lessonId is required" }, { status: 400 });

  const { data: lesson } = await supabase.from("lessons").select("id,course_id").eq("id", lessonId).maybeSingle();
  if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id,course_id,progress,started_at")
    .eq("course_id", lesson.course_id)
    .eq("learner_id", user.id)
    .maybeSingle();
  if (!enrollment) return NextResponse.json({ error: "Enroll in this course first" }, { status: 403 });
  if (enrollment.progress === "completed") return NextResponse.json({ error: "Completed progress cannot move backwards" }, { status: 409 });

  const [{ data: existing }, { count: totalLessons, error: totalError }, { count: finishedLessons, error: finishedError }] = await Promise.all([
    supabase.from("lesson_completions").select("id").eq("enrollment_id", enrollment.id).eq("lesson_id", lessonId).maybeSingle(),
    supabase.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", lesson.course_id),
    supabase.from("lesson_completions").select("id", { count: "exact", head: true }).eq("enrollment_id", enrollment.id),
  ]);
  if (existing) return NextResponse.json({ error: "Lesson already completed", code: "ALREADY_COMPLETED" }, { status: 409 });
  if (totalError || finishedError) return NextResponse.json({ error: totalError?.message ?? finishedError?.message }, { status: 400 });
  if (!totalLessons) return NextResponse.json({ error: "This course has no lessons" }, { status: 409 });

  const now = new Date().toISOString();
  const reachesCompletion = (finishedLessons ?? 0) + 1 >= totalLessons;
  const completionProgress = reachesCompletion ? "completed" : "in_progress";

  const { error: completionError } = await supabase.from("lesson_completions").insert({ enrollment_id: enrollment.id, lesson_id: lessonId, completed_at: now });
  if (completionError) return NextResponse.json({ error: completionError.message }, { status: 400 });

  // The database trigger intentionally requires Not Started → In Progress → Completed.
  // A one-lesson course therefore needs the legal intermediate update before completion.
  if (enrollment.progress === "not_started" && completionProgress === "completed") {
    const { error: startError } = await supabase.from("enrollments").update({ progress: "in_progress", started_at: now, last_progress_at: now }).eq("id", enrollment.id);
    if (startError) return NextResponse.json({ error: startError.message }, { status: 400 });
  }

  const update = {
    progress: completionProgress,
    last_progress_at: now,
    ...(completionProgress === "completed" ? { completed_at: now } : enrollment.progress === "not_started" ? { started_at: now } : {}),
  };
  const { data, error } = await supabase.from("enrollments").update(update).eq("id", enrollment.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("course_activity_log").insert({
    course_id: lesson.course_id,
    actor_id: user.id,
    event: "lesson_completed",
    message: "Lesson completed",
    metadata: { lesson_id: lessonId },
  });
  return NextResponse.json(data);
}
