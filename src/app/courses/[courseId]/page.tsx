import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CourseDetailClient from "./course-detail-client";

type RosterEntry = { id: string; fullName: string; email: string; progress: string; completedLessons: number };

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id,title,description,category,status,profiles!courses_instructor_id_fkey(full_name),lessons(id,title,content,position)")
    .eq("id", courseId)
    .single();

  const { data: { user } } = await supabase.auth.getUser();
  let viewerRole: "instructor" | "learner" | null = null;
  let viewerName: string | undefined;
  let enrollment = null;
  let completedLessonIds: string[] = [];
  let learners: { id: string; full_name: string; email: string }[] = [];
  let roster: RosterEntry[] = [];
  let activities: { id: string; event: string; message: string | null; created_at: string; actor?: { full_name?: string } | { full_name?: string }[] }[] = [];
  let courseRow = course;

  if (user) {
    const { data: viewer } = await supabase.from("profiles").select("role,full_name").eq("id", user.id).maybeSingle();
    viewerRole = viewer?.role ?? null;
    viewerName = viewer?.full_name;

    // RLS hides archived courses from learners. A learner who is enrolled keeps
    // read access to that course, so re-fetch it through the service role.
    if (!courseRow && viewerRole === "learner") {
      const service = createServiceClient();
      const { data: own } = await service.from("enrollments").select("id,progress").eq("course_id", courseId).eq("learner_id", user.id).maybeSingle();
      if (own) {
        enrollment = own;
        const { data: historyCourse } = await service
          .from("courses")
          .select("id,title,description,category,status,profiles!courses_instructor_id_fkey(full_name),lessons(id,title,content,position)")
          .eq("id", courseId)
          .single();
        courseRow = historyCourse;
        const { data: completions } = await service.from("lesson_completions").select("lesson_id").eq("enrollment_id", own.id);
        completedLessonIds = (completions ?? []).map((completion) => completion.lesson_id);
      }
    }

    if (viewerRole === "learner" && !enrollment) {
      const { data } = await supabase.from("enrollments").select("id,progress").eq("course_id", courseId).eq("learner_id", user.id).maybeSingle();
      enrollment = data;
      if (data) {
        const { data: completions } = await supabase.from("lesson_completions").select("lesson_id").eq("enrollment_id", data.id);
        completedLessonIds = (completions ?? []).map((completion) => completion.lesson_id);
      }
    }

    if (viewerRole === "instructor") {
      const { data: learnerRows } = await supabase.from("profiles").select("id,full_name,email").eq("role", "learner").order("full_name");
      learners = learnerRows ?? [];
      // RLS lets instructors read enrollments but not other learners'
      // lesson_completions, so the roster's completion counts come through
      // the service role after the instructor check above.
      const service = createServiceClient();
      const { data: rosterRows } = await service
        .from("enrollments")
        .select("id,progress,learner:profiles!enrollments_learner_id_fkey(id,full_name,email),lesson_completions(lesson_id)")
        .eq("course_id", courseId);
      roster = (rosterRows ?? []).map((row) => {
        const learner = Array.isArray(row.learner) ? row.learner[0] : row.learner;
        return {
          id: row.id,
          fullName: learner?.full_name ?? "Unknown learner",
          email: learner?.email ?? "",
          progress: row.progress,
          completedLessons: (row.lesson_completions ?? []).length,
        };
      });
    }

    if (courseRow) {
      const { data: activityRows } = await supabase.from("course_activity_log").select("id,event,message,created_at,actor:profiles(full_name)").eq("course_id", courseId).order("created_at", { ascending: false }).limit(20);
      activities = activityRows ?? [];
    }
  }

  if (!courseRow) notFound();

  const profile = Array.isArray(courseRow.profiles) ? courseRow.profiles[0] : courseRow.profiles;
  return <CourseDetailClient
    course={{ ...courseRow, instructor: (profile as { full_name?: string } | null)?.full_name, lessons: [...(courseRow.lessons ?? [])].sort((a, b) => a.position - b.position) }}
    enrollment={enrollment}
    completedLessonIds={completedLessonIds}
    viewerRole={viewerRole}
    learners={learners}
    roster={roster}
    activities={activities}
    viewerName={viewerName}
  />;
}
