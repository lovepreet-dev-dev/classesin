import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params; const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single(); if (profile?.role !== "instructor") return NextResponse.json({ error: "Instructor access required" }, { status: 403 });
  const { data: course } = await supabase.from("courses").select("status").eq("id", courseId).single(); const { count } = await supabase.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", courseId); if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 }); if (course.status !== "draft") return NextResponse.json({ error: "Only draft courses can be published" }, { status: 409 }); if (!count) return NextResponse.json({ error: "Add at least one lesson before publishing this course" }, { status: 422 });
  const { data, error } = await supabase.from("courses").update({ status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", courseId).select().single(); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); await supabase.from("course_activity_log").insert({ course_id: courseId, actor_id: user.id, event: "published", message: "Course published" }); return NextResponse.json(data);
}
