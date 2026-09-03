import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";

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
