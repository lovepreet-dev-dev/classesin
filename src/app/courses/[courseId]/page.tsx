import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DEMO_ACTIVITY, DEMO_COURSES, DEMO_LEARNERS, demoLessons } from "@/lib/demo-data";
import CourseDetailClient from "./course-detail-client";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const demoCourse = DEMO_COURSES.find((item) => item.id === courseId);
    if (!demoCourse) notFound();
    return <CourseDetailClient course={{ ...demoCourse, status: demoCourse.status.toLowerCase(), lessons: demoLessons(courseId) }} enrollment={null} completedLessonIds={[]} viewerRole="instructor" learners={DEMO_LEARNERS.map((person) => ({ id: person.id, full_name: person.fullName, email: person.email }))} activities={DEMO_ACTIVITY.filter((item) => item.courseId === courseId).map((item) => ({ id: item.id, event: item.event, message: item.d, created_at: new Date().toISOString() }))} roster={[]} pendingRequests={[]} myRequestStatus={null} demoMode />;
  }

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
  let activities: { id: string; event: string; message: string | null; created_at: string; actor?: { full_name?: string } | { full_name?: string }[] }[] = [];
  let roster: { id: string; progress: string; enrolled_at: string; last_progress_at: string | null; learner: { id: string; full_name: string; email: string } | null; completedLessonIds: string[] }[] = [];
  let pendingRequests: { id: string; status: string; created_at: string; learner: { id: string; full_name: string; email: string } | null }[] = [];
  let myRequestStatus: string | null = null;
  let courseRow = course;

  if (user) {
    const { data: viewer } = await supabase.from("profiles").select("role,full_name").eq("id", user.id).maybeSingle();
    viewerRole = viewer?.role ?? null;
    viewerName = viewer?.full_name;

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

    if (viewerRole === "learner" && !enrollment) {
      const { data: latestRequest } = await supabase
        .from("enrollment_requests")
        .select("status")
        .eq("course_id", courseId)
        .eq("learner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      myRequestStatus = latestRequest?.status ?? null;
    }

    if (viewerRole === "instructor") {
      const { data: learnerRows } = await supabase.from("profiles").select("id,full_name,email").eq("role", "learner").order("full_name");
      learners = learnerRows ?? [];

      const service = createServiceClient();
      const { data: enrollmentRows } = await service
        .from("enrollments")
        .select("id,progress,enrolled_at,last_progress_at,learner:profiles!enrollments_learner_id_fkey(id,full_name,email),lesson_completions(lesson_id)")
        .eq("course_id", courseId)
        .order("enrolled_at", { ascending: false });
      roster = (enrollmentRows ?? []).map((row) => {
        const learner = Array.isArray(row.learner) ? row.learner[0] ?? null : row.learner;
        const completions = Array.isArray(row.lesson_completions) ? row.lesson_completions : [];
        return {
          id: row.id,
          progress: row.progress,
          enrolled_at: row.enrolled_at,
          last_progress_at: row.last_progress_at,
          learner,
          completedLessonIds: completions.map((completion: { lesson_id: string }) => completion.lesson_id),
        };
      });

      const { data: requestRows } = await service
        .from("enrollment_requests")
        .select("id,status,created_at,learner:profiles!enrollment_requests_learner_id_fkey(id,full_name,email)")
        .eq("course_id", courseId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      pendingRequests = (requestRows ?? []).map((row) => ({
        id: row.id,
        status: row.status,
        created_at: row.created_at,
        learner: Array.isArray(row.learner) ? row.learner[0] ?? null : row.learner,
      }));
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
    activities={activities}
    viewerName={viewerName}
    roster={roster}
    pendingRequests={pendingRequests}
    myRequestStatus={myRequestStatus}
  />;
}
