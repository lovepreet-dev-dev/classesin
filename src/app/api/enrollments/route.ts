import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 }); const body = await request.json(); const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single(); const learnerId = body.learnerId ?? user.id;
  if (learnerId !== user.id && profile?.role !== "instructor") return NextResponse.json({ error: "Only instructors can enroll another learner" }, { status: 403 }); if (learnerId === user.id && profile?.role === "instructor") return NextResponse.json({ error: "Instructors must choose a learner" }, { status: 403 });
  if (!body.courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  const { data: course } = await supabase.from("courses").select("status").eq("id", body.courseId).single(); if (!course || course.status !== "published") return NextResponse.json({ error: "Only published courses can be joined" }, { status: 409 });
  const { data, error } = await supabase.from("enrollments").insert({ course_id: body.courseId, learner_id: learnerId }).select().single(); if (error?.code === "23505") return NextResponse.json({ error: "Already enrolled", code: "ALREADY_ENROLLED" }, { status: 409 }); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json(data, { status: 201 });
}
