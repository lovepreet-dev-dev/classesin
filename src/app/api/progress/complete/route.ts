import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const lessonId = String(body.lessonId ?? "");
  if (!lessonId) return NextResponse.json({ error: "lessonId is required" }, { status: 400 });

  const targetLearnerId = body.learnerId ? String(body.learnerId) : user.id;
  const instructorActing = targetLearnerId !== user.id;
  if (instructorActing && !hasRole(profile, "instructor")) {
    return NextResponse.json({ error: "Only instructors can update another learner's progress" }, { status: 403 });
  }

  const service = instructorActing ? createServiceClient() : null;
  const db = service ?? supabase;

  const { data: lesson } = await db.from("lessons").select("id,course_id").eq("id", lessonId).maybeSingle();
  if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  const { data: enrollment } = await db
    .from("enrollments")
    .select("id,course_id,progress,started_at")
    .eq("course_id", lesson.course_id)
    .eq("learner_id", targetLearnerId)
    .maybeSingle();
  if (!enrollment) return NextResponse.json({ error: "Enroll in this course first" }, { status: 403 });
  if (enrollment.progress === "completed") return NextResponse.json({ error: "Completed progress cannot move backwards" }, { status: 409 });

  const [{ data: existing }, { count: totalLessons, error: totalError }, { count: finishedLessons, error: finishedError }] = await Promise.all([
    db.from("lesson_completions").select("id").eq("enrollment_id", enrollment.id).eq("lesson_id", lessonId).maybeSingle(),
    db.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", lesson.course_id),
    db.from("lesson_completions").select("id", { count: "exact", head: true }).eq("enrollment_id", enrollment.id),
  ]);
  if (existing) return NextResponse.json({ error: "Lesson already completed", code: "ALREADY_COMPLETED" }, { status: 409 });
  if (totalError || finishedError) return NextResponse.json({ error: totalError?.message ?? finishedError?.message }, { status: 400 });
  if (!totalLessons) return NextResponse.json({ error: "This course has no lessons" }, { status: 409 });

  const now = new Date().toISOString();
  const reachesCompletion = (finishedLessons ?? 0) + 1 >= totalLessons;
  const completionProgress = reachesCompletion ? "completed" : "in_progress";

  const { error: completionError } = await db.from("lesson_completions").insert({ enrollment_id: enrollment.id, lesson_id: lessonId, completed_at: now });
  if (completionError?.code === "23505") return NextResponse.json({ error: "Lesson already completed", code: "ALREADY_COMPLETED" }, { status: 409 });
  if (completionError) return NextResponse.json({ error: completionError.message }, { status: 400 });

  if (enrollment.progress === "not_started" && completionProgress === "completed") {
    const { error: startError } = await db.from("enrollments").update({ progress: "in_progress", started_at: now, last_progress_at: now }).eq("id", enrollment.id);
    if (startError) return NextResponse.json({ error: startError.message }, { status: 400 });
  }

  const update = {
    progress: completionProgress,
    last_progress_at: now,
    ...(completionProgress === "completed" ? { completed_at: now } : enrollment.progress === "not_started" ? { started_at: now } : {}),
  };
  const { data, error } = await db.from("enrollments").update(update).eq("id", enrollment.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let message = "Lesson completed";
  if (instructorActing && service) {
    const { data: learner } = await service.from("profiles").select("full_name").eq("id", targetLearnerId).maybeSingle();
    if (learner?.full_name) message = `Lesson completed for ${learner.full_name}`;
  }

  await db.from("course_activity_log").insert({
    course_id: lesson.course_id,
    actor_id: user.id,
    event: "lesson_completed",
    message,
    metadata: { lesson_id: lessonId, learner_id: targetLearnerId },
  });
  return NextResponse.json(data);
}
