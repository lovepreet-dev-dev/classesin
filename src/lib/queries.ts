import type { SupabaseClient } from "@supabase/supabase-js";

/** Shared read queries for the workspace API routes. Each returns the same payload its route has always served. */

type QueryResult<T> = { data: T; error: string | null };

const eventTitles: Record<string, string> = {
  created: "Course created",
  edited: "Course edited",
  published: "Course published",
  archived: "Course archived",
  restored: "Course restored",
  commented: "Comment added",
  lesson_completed: "Learner completed lesson",
  enrolled: "Learner enrolled",
  alert_dismissed: "Inactivity alert dismissed",
};

export async function getDashboard(supabase: SupabaseClient): Promise<QueryResult<Record<string, unknown>>> {
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
  if (errors.length) return { data: null as never, error: errors[0]!.message };
  const weekly = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(Date.now() - (7 - index) * 7 * 24 * 60 * 60 * 1000); const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { week: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }), completions: (completionRows.data ?? []).filter((row) => row.completed_at && new Date(row.completed_at) >= start && new Date(row.completed_at) < end).length };
  });
  const progressBreakdown = ["completed", "in_progress", "not_started"].map((progress) => ({ progress, count: (enrollmentRows.data ?? []).filter((row) => row.progress === progress).length }));
  const byCourse = new Map<string, { id: string; course: string; enrolled: number; completed: number; inProgress: number; notStarted: number }>();
  for (const course of courseRows.data ?? []) byCourse.set(course.id, { id: course.id, course: course.title, enrolled: 0, completed: 0, inProgress: 0, notStarted: 0 });
  for (const row of enrollmentRows.data ?? []) {
    const item = byCourse.get(row.course_id);
    if (!item) continue;
    item.enrolled += 1;
    if (row.progress === "completed") item.completed += 1;
    if (row.progress === "in_progress") item.inProgress += 1;
    if (row.progress === "not_started") item.notStarted += 1;
  }
  const courseBreakdown = [...byCourse.values()].sort((a, b) => b.enrolled - a.enrolled || a.course.localeCompare(b.course));
  return {
    data: { totalLearners: learners.count ?? 0, publishedCourses: published.count ?? 0, completionsThisMonth: completions.count ?? 0, inProgress: inProgress.count ?? 0, completionTotal: weekly.reduce((sum, item) => sum + item.completions, 0), weekly, courseBreakdown, progressBreakdown },
    error: null,
  };
}

export async function getAlerts(supabase: SupabaseClient): Promise<QueryResult<unknown[]>> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: enrollments, error } = await supabase.from("enrollments").select("id,course_id,learner_id,last_progress_at,courses(title),profiles!enrollments_learner_id_fkey(full_name,email)").eq("progress", "in_progress").lt("last_progress_at", cutoff);
  if (error) return { data: [], error: error.message };
  const ids = (enrollments ?? []).map((item) => item.id);
  const { data: dismissals } = ids.length ? await supabase.from("alert_dismissals").select("enrollment_id,dismissed_for_progress_at").in("enrollment_id", ids).order("dismissed_at", { ascending: false }) : { data: [] };
  const latest = new Map<string, string | null>();
  for (const item of dismissals ?? []) if (!latest.has(item.enrollment_id)) latest.set(item.enrollment_id, item.dismissed_for_progress_at);
  const active = (enrollments ?? []).filter((item) => latest.get(item.id) !== item.last_progress_at);
  return { data: active, error: null };
}

export async function getPeople(supabase: SupabaseClient): Promise<QueryResult<unknown[]>> {
  const { data, error } = await supabase.from("profiles").select("id,full_name,email,enrollments:enrollments!enrollments_learner_id_fkey(progress,last_progress_at)").eq("role", "learner").order("full_name");
  if (error) return { data: [], error: error.message };
  const people = (data ?? []).map((item) => {
    const enrollments = item.enrollments ?? [];
    const progress = enrollments.some((row) => row.progress === "in_progress") ? "in_progress" : enrollments.some((row) => row.progress === "not_started") ? "not_started" : enrollments.some((row) => row.progress === "completed") ? "completed" : "not_started";
    const latest = enrollments.map((row) => row.last_progress_at).filter(Boolean).sort().at(-1) ?? null;
    return { id: item.id, full_name: item.full_name, email: item.email, courses: enrollments.length, progress, last_active: latest };
  });
  return { data: people, error: null };
}

export async function getActivity(supabase: SupabaseClient): Promise<QueryResult<unknown[]>> {
  const { data, error } = await supabase.from("course_activity_log").select("id,event,message,created_at,actor:profiles(full_name),course:courses(title)").order("created_at", { ascending: false }).limit(50);
  if (error) return { data: [], error: error.message };
  const activity = (data ?? []).map((item) => {
    const actor = Array.isArray(item.actor) ? item.actor[0] : item.actor;
    const course = Array.isArray(item.course) ? item.course[0] : item.course;
    const message = item.message || course?.title || "Workspace activity";
    return { id: item.id, t: eventTitles[item.event] ?? "Activity", d: message, by: actor?.full_name ?? "System", when: new Date(item.created_at).toLocaleString(), event: item.event };
  });
  return { data: activity, error: null };
}

export async function getInstructors(supabase: SupabaseClient): Promise<QueryResult<unknown[]>> {
  const { data, error } = await supabase.from("profiles").select("id,full_name").eq("role", "instructor").order("full_name");
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function getLearnerEnrollments(supabase: SupabaseClient, learnerId: string): Promise<QueryResult<unknown[]>> {
  // The service role keeps an archived course visible in the enrollment list of
  // learners who are enrolled in it, while the query only ever returns rows for
  // the requesting learner.
  const { data, error } = await supabase.from("enrollments").select("id,progress,enrolled_at,started_at,completed_at,last_progress_at,lesson_completions(count),courses(id,title,description,category,status,profiles!courses_instructor_id_fkey(full_name),lessons(id,title,content,position),enrollments(count))").eq("learner_id", learnerId).order("enrolled_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []).map((row) => {
    const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
    return { ...row, enrollments: course?.enrollments ?? [] };
  });
  return { data: rows, error: null };
}
