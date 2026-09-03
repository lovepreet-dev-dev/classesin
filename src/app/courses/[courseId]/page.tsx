import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CourseDetailClient from "./course-detail-client";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params; if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) notFound(); const supabase = await createClient(); const { data: course } = await supabase.from("courses").select("id,title,description,category,status,profiles!courses_instructor_id_fkey(full_name),lessons(id,title,content,position)").eq("id", courseId).single(); if (!course) notFound(); const { data: { user } } = await supabase.auth.getUser(); let enrollment = null; let completedLessonIds: string[] = []; if (user) { const { data } = await supabase.from("enrollments").select("id,progress").eq("course_id", courseId).eq("learner_id", user.id).maybeSingle(); enrollment = data; if (data) { const { data: completions } = await supabase.from("lesson_completions").select("lesson_id").eq("enrollment_id", data.id); completedLessonIds = (completions ?? []).map((completion) => completion.lesson_id); } } const profile = Array.isArray(course.profiles) ? course.profiles[0] : course.profiles; return <CourseDetailClient course={{ ...course, instructor: (profile as { full_name?: string } | null)?.full_name, lessons: [...(course.lessons ?? [])].sort((a, b) => a.position - b.position) }} enrollment={enrollment} completedLessonIds={completedLessonIds} />;
}
