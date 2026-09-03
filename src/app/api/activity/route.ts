import { NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";

const eventTitles: Record<string, string> = {
  created: "Course created",
  edited: "Course edited",
  published: "Course published",
  archived: "Course archived",
  restored: "Course restored",
  commented: "Comment added",
  lesson_completed: "Learner completed lesson",
  enrolled: "Learner enrolled",
  alert_dismissed: "Inactivity alert dismissed",
};

export async function GET() {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasRole(profile, "instructor")) return NextResponse.json({ error: "Instructor access required" }, { status: 403 });
  const { data, error } = await supabase.from("course_activity_log").select("id,event,message,created_at,actor:profiles(full_name),course:courses(title)").order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const activity = (data ?? []).map((item) => {
    const actor = Array.isArray(item.actor) ? item.actor[0] : item.actor;
    const course = Array.isArray(item.course) ? item.course[0] : item.course;
    const message = item.message || course?.title || "Workspace activity";
    return { id: item.id, t: eventTitles[item.event] ?? "Activity", d: message, by: actor?.full_name ?? "System", when: new Date(item.created_at).toLocaleString(), event: item.event };
  });
  return NextResponse.json({ activity });
}
