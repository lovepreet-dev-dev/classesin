import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getLearnerEnrollments } from "@/lib/queries";

export async function GET() {
  const { user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "learner")) return NextResponse.json({ error: "Learner access required" }, { status: 403 });
  const { data, error } = await getLearnerEnrollments(createServiceClient(), user.id);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ enrollments: data });
}

export async function POST(request: NextRequest) {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json();
  const courseId = String(body.courseId ?? "");
  if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });

  const learnerId = body.learnerId ? String(body.learnerId) : user.id;
  const instructorEnrolling = hasRole(profile, "instructor") && learnerId !== user.id;
  if (learnerId !== user.id && !hasRole(profile, "instructor")) return NextResponse.json({ error: "Only instructors can enroll another learner" }, { status: 403 });
  if (hasRole(profile, "instructor") && !body.learnerId) return NextResponse.json({ error: "Choose a learner to enroll" }, { status: 400 });

  const { data: target } = await supabase.from("profiles").select("role").eq("id", learnerId).maybeSingle();
  if (!target) return NextResponse.json({ error: "Learner not found" }, { status: 404 });
  if (target.role !== "learner") return NextResponse.json({ error: "Enrollments can only be created for learner accounts" }, { status: 400 });

  const { data: course } = await supabase.from("courses").select("status").eq("id", courseId).single();
  if (!course || course.status !== "published") return NextResponse.json({ error: "Only published courses can be joined" }, { status: 409 });

  const { data, error } = await supabase.from("enrollments").insert({ course_id: courseId, learner_id: learnerId }).select().single();
  if (error?.code === "23505") return NextResponse.json({ error: "Already enrolled", code: "ALREADY_ENROLLED" }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabase.from("course_activity_log").insert({ course_id: courseId, actor_id: user.id, event: "enrolled", message: instructorEnrolling ? "Learner enrolled by instructor" : "Learner enrolled" , metadata: { learner_id: learnerId } });
  return NextResponse.json(data, { status: 201 });
}
