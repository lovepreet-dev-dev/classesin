import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ACTIVITY, DEMO_COURSES, DEMO_LEARNERS, demoLessons } from "@/lib/demo-data";
import CourseDetailClient from "./course-detail-client";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const demoCourse = DEMO_COURSES.find((item) => item.id === courseId);
    if (!demoCourse) notFound();
    return <CourseDetailClient course={{ ...demoCourse, status: demoCourse.status.toLowerCase(), lessons: demoLessons(courseId) }} enrollment={null} completedLessonIds={[]} viewerRole="instructor" learners={DEMO_LEARNERS.map((person) => ({ id: person.id, full_name: person.fullName, email: person.email }))} activities={DEMO_ACTIVITY.filter((item) => item.courseId === courseId).map((item) => ({ id: item.id, event: item.event, message: item.d, created_at: new Date().toISOString() }))} demoMode />;
  }

  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id,title,description,category,status,profiles!courses_instructor_id_fkey(full_name),lessons(id,title,content,position)")
    .eq("id", courseId)
    .single();
  if (!course) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  let viewerRole: "instructor" | "learner" | null = null;
  let enrollment = null;
  let completedLessonIds: string[] = [];
  let learners: { id: string; full_name: string; email: string }[] = [];
  let activities: { id: string; event: string; message: string | null; created_at: string; actor?: { full_name?: string } | { full_name?: string }[] }[] = [];

  if (user) {
    const { data: viewer } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    viewerRole = viewer?.role ?? null;

    if (viewerRole === "learner") {
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
    }

    const { data: activityRows } = await supabase.from("course_activity_log").select("id,event,message,created_at,actor:profiles(full_name)").eq("course_id", courseId).order("created_at", { ascending: false }).limit(20);
    activities = activityRows ?? [];
  }

  const profile = Array.isArray(course.profiles) ? course.profiles[0] : course.profiles;
  return <CourseDetailClient
    course={{ ...course, instructor: (profile as { full_name?: string } | null)?.full_name, lessons: [...(course.lessons ?? [])].sort((a, b) => a.position - b.position) }}
    enrollment={enrollment}
    completedLessonIds={completedLessonIds}
    viewerRole={viewerRole}
    learners={learners}
    activities={activities}
  />;
}
