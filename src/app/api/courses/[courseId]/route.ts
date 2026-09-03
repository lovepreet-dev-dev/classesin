import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params; const supabase = await createClient(); const { data: course, error } = await supabase.from("courses").select("*, profiles!courses_instructor_id_fkey(full_name), lessons(id,title,content,position)").eq("id", courseId).single(); if (error || !course) return NextResponse.json({ error: "Course not found" }, { status: 404 }); return NextResponse.json({ ...course, lessons: [...(course.lessons ?? [])].sort((a, b) => a.position - b.position) });
}
