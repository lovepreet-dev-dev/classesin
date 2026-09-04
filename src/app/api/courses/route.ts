import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const category = params.get("category");
  const status = params.get("status");
  const instructor = params.get("instructor");
  const sort = params.get("sort") ?? "created_at";
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize") ?? 10)));
  let query = supabase.from("courses").select("*, profiles!courses_instructor_id_fkey(full_name), enrollments(count), lessons(count)");
  if (!hasRole(profile, "instructor")) query = query.eq("status", "published");
  if (q) {
    const safeQuery = q.replace(/[(),]/g, " ");
    query = query.or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`);
  }
  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);
  if (instructor) query = query.eq("instructor_id", instructor);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = [...(data ?? [])];
  // RLS limits a learner's enrollments(count) embed to their own enrollment and
  // hides the instructor's profile row, so the catalogue's learner counts and
  // instructor names come from the service role after the role-checked,
  // published-only query above.
  if (!hasRole(profile, "instructor") && rows.length) {
    const service = createServiceClient();
    const ids = rows.map((row) => row.id);
    const [counts, meta] = await Promise.all([
      service.from("enrollments").select("course_id").in("course_id", ids),
      service.from("courses").select("id,profiles!courses_instructor_id_fkey(full_name)").in("id", ids),
    ]);
    const tally = new Map<string, number>();
    for (const row of counts.data ?? []) tally.set(row.course_id, (tally.get(row.course_id) ?? 0) + 1);
    const instructorsByName = new Map<string, string>();
    for (const row of meta.data ?? []) {
      const instructor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (instructor?.full_name) instructorsByName.set(row.id, instructor.full_name);
    }
    for (const row of rows) {
      row.enrollments = [{ count: tally.get(row.id) ?? 0 }];
      const name = instructorsByName.get(row.id);
      if (name) row.profiles = { full_name: name };
    }
  }
  rows.sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "enrollment_count") return (Number(b.enrollments?.[0]?.count ?? 0) - Number(a.enrollments?.[0]?.count ?? 0)) || a.title.localeCompare(b.title);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const start = (page - 1) * pageSize;
  return NextResponse.json({ data: rows.slice(start, start + pageSize), count: rows.length, page, pageSize });
}

export async function POST(request: NextRequest) {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "instructor")) return NextResponse.json({ error: "Instructor access required" }, { status: 403 });
  const body = await request.json();
  if (!body.title?.trim() || !body.category?.trim()) return NextResponse.json({ error: "Title and category are required" }, { status: 400 });
  const { data, error } = await supabase.from("courses").insert({ title: body.title.trim(), description: String(body.description ?? "").trim(), category: body.category.trim(), instructor_id: user.id, status: "draft" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabase.from("course_activity_log").insert({ course_id: data.id, actor_id: user.id, event: "created", message: "Course created" });
  return NextResponse.json(data, { status: 201 });
}
