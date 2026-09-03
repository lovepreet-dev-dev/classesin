import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient(); const params = request.nextUrl.searchParams; const q = params.get("q") ?? ""; const category = params.get("category"); const status = params.get("status"); const page = Math.max(1, Number(params.get("page") ?? 1)); const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize") ?? 10)));
  let query = supabase.from("courses").select("*, profiles!courses_instructor_id_fkey(full_name), enrollments(count), lessons(count)", { count: "exact" });
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`); if (category) query = query.eq("category", category); if (status) query = query.eq("status", status); const { data, error, count } = await query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ data, count: count ?? 0, page, pageSize });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 }); const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single(); if (profile?.role !== "instructor") return NextResponse.json({ error: "Instructor access required" }, { status: 403 }); const body = await request.json(); if (!body.title || !body.category) return NextResponse.json({ error: "Title and category are required" }, { status: 400 }); const { data, error } = await supabase.from("courses").insert({ title: body.title, description: body.description ?? "", category: body.category, instructor_id: user.id, status: "draft" }).select().single(); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); await supabase.from("course_activity_log").insert({ course_id: data.id, actor_id: user.id, event: "created", message: "Course created" }); return NextResponse.json(data, { status: 201 });
}
