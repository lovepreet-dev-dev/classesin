import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/db-errors";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const lessonId = String(body.lessonId ?? "");
  if (!lessonId) return NextResponse.json({ error: "lessonId is required" }, { status: 400 });

  const { data, error } = await supabase.rpc("complete_lesson", { p_lesson_id: lessonId });
  if (error) return dbErrorResponse(error);
  return NextResponse.json(data);
}
