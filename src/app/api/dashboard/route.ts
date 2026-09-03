import { NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";

export async function GET() {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "instructor")) return NextResponse.json({ error: "Instructor access required" }, { status: 403 });
  const firstOfMonth = new Date(); firstOfMonth.setUTCDate(1); firstOfMonth.setUTCHours(0, 0, 0, 0);
  const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString();
  const [learners, published, completions, inProgress, completionRows, enrollmentRows, courseRows] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "learner"),
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("progress", "completed").gte("completed_at", firstOfMonth.toISOString()),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("progress", "in_progress"),
    supabase.from("enrollments").select("completed_at").eq("progress", "completed").gte("completed_at", eightWeeksAgo),
    supabase.from("enrollments").select("course_id,progress"),
    supabase.from("courses").select("id,title").order("title"),
  ]);
  const errors = [learners, published, completions, inProgress, completionRows, enrollmentRows, courseRows].map((result) => result.error).filter(Boolean);
  if (errors.length) return NextResponse.json({ error: errors[0]!.message }, { status: 400 });
  const weekly = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(Date.now() - (7 - index) * 7 * 24 * 60 * 60 * 1000); const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { week: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }), completions: (completionRows.data ?? []).filter((row) => row.completed_at && new Date(row.completed_at) >= start && new Date(row.completed_at) < end).length };
  });
  const progressBreakdown = ["completed", "in_progress", "not_started"].map((progress) => ({ progress, count: (enrollmentRows.data ?? []).filter((row) => row.progress === progress).length }));
  const byCourse = new Map<string, { course: string; enrolled: number; completed: number; inProgress: number; notStarted: number }>();
  for (const course of courseRows.data ?? []) byCourse.set(course.id, { course: course.title, enrolled: 0, completed: 0, inProgress: 0, notStarted: 0 });
  for (const row of enrollmentRows.data ?? []) {
    const item = byCourse.get(row.course_id);
    if (!item) continue;
    item.enrolled += 1;
    if (row.progress === "completed") item.completed += 1;
    if (row.progress === "in_progress") item.inProgress += 1;
    if (row.progress === "not_started") item.notStarted += 1;
  }
  const courseBreakdown = [...byCourse.values()].sort((a, b) => b.enrolled - a.enrolled || a.course.localeCompare(b.course));
  return NextResponse.json({ totalLearners: learners.count ?? 0, publishedCourses: published.count ?? 0, completionsThisMonth: completions.count ?? 0, inProgress: inProgress.count ?? 0, completionTotal: weekly.reduce((sum, item) => sum + item.completions, 0), weekly, courseBreakdown, progressBreakdown });
}
