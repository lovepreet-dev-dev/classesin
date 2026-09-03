import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

type Decision = "approved" | "rejected";

export async function GET(request: NextRequest) {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const statusParam = request.nextUrl.searchParams.get("status");

  if (hasRole(profile, "instructor")) {
    const { data: ownedCourses } = await supabase.from("courses").select("id").eq("instructor_id", user.id);
    const courseIds = (ownedCourses ?? []).map((row) => row.id);
    if (!courseIds.length) return NextResponse.json({ requests: [] });
    const status = statusParam ?? "pending";
    let query = createServiceClient()
      .from("enrollment_requests")
      .select("id,course_id,learner_id,status,created_at,decided_at,courses!inner(id,title),learner:profiles!enrollment_requests_learner_id_fkey(id,full_name,email)")
      .in("course_id", courseIds)
      .order("created_at", { ascending: false });
    if (status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ requests: data ?? [] });
  }

  if (!hasRole(profile, "learner")) return NextResponse.json({ error: "Learner access required" }, { status: 403 });
  let query = supabase
    .from("enrollment_requests")
    .select("id,course_id,status,created_at,decided_at,courses(id,title)")
    .eq("learner_id", user.id)
    .order("created_at", { ascending: false });
  if (statusParam) query = query.eq("status", statusParam);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "learner")) return NextResponse.json({ error: "Learner access required" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const courseId = String(body.courseId ?? "");
  if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });

  const { data: course } = await supabase.from("courses").select("id,status").eq("id", courseId).maybeSingle();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (course.status !== "published") return NextResponse.json({ error: "Only published courses accept enrollment requests" }, { status: 409 });

  const { data: enrollment } = await supabase.from("enrollments").select("id").eq("course_id", courseId).eq("learner_id", user.id).maybeSingle();
  if (enrollment) return NextResponse.json({ error: "Already enrolled", code: "ALREADY_ENROLLED" }, { status: 409 });

  const { data: pending } = await supabase
    .from("enrollment_requests")
    .select("id")
    .eq("course_id", courseId)
    .eq("learner_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) return NextResponse.json({ error: "An enrollment request is already pending", code: "PENDING_REQUEST_EXISTS" }, { status: 409 });

  const { data, error } = await supabase
    .from("enrollment_requests")
    .insert({ course_id: courseId, learner_id: user.id })
    .select("id,course_id,learner_id,status,created_at")
    .single();
  if (error?.code === "23505") return NextResponse.json({ error: "An enrollment request is already pending", code: "PENDING_REQUEST_EXISTS" }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  try {
    await createServiceClient().from("course_activity_log").insert({
      course_id: courseId,
      actor_id: user.id,
      event: "enrollment_requested",
      message: "Enrollment requested",
      metadata: { learner_id: user.id, request_id: data.id },
    });
  } catch {
    return NextResponse.json(data, { status: 201 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "instructor")) return NextResponse.json({ error: "Instructor access required" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const requestId = String(body.requestId ?? "");
  const decision = String(body.decision ?? "") as Decision;
  if (!requestId) return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  if (decision !== "approved" && decision !== "rejected") return NextResponse.json({ error: "decision must be approved or rejected" }, { status: 400 });

  const service = createServiceClient();
  const { data: enrollmentRequest } = await service
    .from("enrollment_requests")
    .select("id,course_id,learner_id,status")
    .eq("id", requestId)
    .maybeSingle();
  if (!enrollmentRequest) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  const { data: course } = await service.from("courses").select("id,instructor_id").eq("id", enrollmentRequest.course_id).maybeSingle();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (course.instructor_id !== user.id) return NextResponse.json({ error: "Only the course instructor can decide" }, { status: 403 });
  if (enrollmentRequest.status !== "pending") return NextResponse.json({ error: "Request already decided", code: "ALREADY_DECIDED" }, { status: 409 });

  const now = new Date().toISOString();

  if (decision === "rejected") {
    const { data, error } = await service
      .from("enrollment_requests")
      .update({ status: "rejected", decided_at: now, decided_by: user.id })
      .eq("id", requestId)
      .select("id,course_id,learner_id,status,created_at,decided_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    try {
      await service.from("course_activity_log").insert({
        course_id: enrollmentRequest.course_id,
        actor_id: user.id,
        event: "enrollment_rejected",
        message: "Enrollment request declined",
        metadata: { learner_id: enrollmentRequest.learner_id, request_id: requestId },
      });
    } catch {
      return NextResponse.json({ request: data });
    }
    return NextResponse.json({ request: data });
  }

  const { data: enrollmentRow, error: enrollmentError } = await service
    .from("enrollments")
    .insert({ course_id: enrollmentRequest.course_id, learner_id: enrollmentRequest.learner_id })
    .select("id,course_id,learner_id,progress")
    .single();
  if (enrollmentError && enrollmentError.code !== "23505") return NextResponse.json({ error: enrollmentError.message }, { status: 400 });

  let enrollment = enrollmentRow;
  if (enrollmentError?.code === "23505") {
    const { data: existing } = await service
      .from("enrollments")
      .select("id,course_id,learner_id,progress")
      .eq("course_id", enrollmentRequest.course_id)
      .eq("learner_id", enrollmentRequest.learner_id)
      .maybeSingle();
    enrollment = existing;
  }

  const { data, error } = await service
    .from("enrollment_requests")
    .update({ status: "approved", decided_at: now, decided_by: user.id })
    .eq("id", requestId)
    .select("id,course_id,learner_id,status,created_at,decided_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await service.from("course_activity_log").insert({
    course_id: enrollmentRequest.course_id,
    actor_id: user.id,
    event: "enrolled",
    message: "Enrollment request approved",
    metadata: { learner_id: enrollmentRequest.learner_id, request_id: requestId },
  });
  return NextResponse.json({ request: data, enrollment });
}
