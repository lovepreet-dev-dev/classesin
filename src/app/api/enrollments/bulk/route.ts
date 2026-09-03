import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";

type BulkStatus = "unknown" | "already_enrolled" | "newly_enrolled" | "error";

export async function POST(request: NextRequest) {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "instructor")) return NextResponse.json({ error: "Instructor access required" }, { status: 403 });

  const body = await request.json();
  const courseId = String(body.courseId ?? "");
  const rawEmails: unknown[] = Array.isArray(body.emails) ? body.emails : String(body.emails ?? "").split(/[\s,;]+/);
  const emails = [...new Set(rawEmails.filter((email): email is string => typeof email === "string").map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (!courseId || !emails.length) return NextResponse.json({ error: "courseId and at least one email are required" }, { status: 400 });

  const { data: course } = await supabase.from("courses").select("status,instructor_id").eq("id", courseId).single();
  if (!course || course.status !== "published") return NextResponse.json({ error: "Only published courses can be bulk-enrolled" }, { status: 409 });
  if (course.instructor_id !== user.id) return NextResponse.json({ error: "You can only bulk-enroll learners in your own courses" }, { status: 403 });

  const { data: learnerRows } = await supabase.from("profiles").select("id,email").eq("role", "learner").in("email", emails);
  const learners = (learnerRows ?? []) as { id: string; email: string }[];
  const byEmail = new Map(learners.map((learner) => [learner.email.toLowerCase(), learner]));
  const { data: existingRows } = await supabase.from("enrollments").select("learner_id").eq("course_id", courseId).in("learner_id", learners.map((learner) => learner.id));
  const existingIds = new Set(((existingRows ?? []) as { learner_id: string }[]).map((row) => row.learner_id));
  const results: { email: string; status: BulkStatus }[] = [];

  for (const email of emails) {
    const learner = byEmail.get(email);
    if (!learner) { results.push({ email, status: "unknown" }); continue; }
    if (existingIds.has(learner.id)) { results.push({ email, status: "already_enrolled" }); continue; }
    const { data: enrollmentRow, error } = await supabase.from("enrollments").insert({ course_id: courseId, learner_id: learner.id }).select("id").maybeSingle();
    const status: BulkStatus = error?.code === "23505" ? "already_enrolled" : error ? "error" : "newly_enrolled";
    results.push({ email, status });
    if (enrollmentRow && status === "newly_enrolled") await supabase.from("course_activity_log").insert({ course_id: courseId, actor_id: user.id, event: "enrolled", message: `Learner enrolled: ${email}`, metadata: { enrollment_id: enrollmentRow.id, learner_id: learner.id } });
  }

  return NextResponse.json({ courseId, results, summary: { newlyEnrolled: results.filter((row) => row.status === "newly_enrolled").length, alreadyEnrolled: results.filter((row) => row.status === "already_enrolled").length, unknown: results.filter((row) => row.status === "unknown").length } });
}
