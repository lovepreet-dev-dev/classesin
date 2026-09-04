import { NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getActivity, getAlerts, getDashboard, getInstructors, getLearnerEnrollments, getPeople } from "@/lib/queries";

/** One round trip for everything the workspace needs on mount. Instructor and learner payloads differ. */
export async function GET() {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  if (hasRole(profile, "instructor")) {
    const [dashboard, alerts, people, activity, instructors] = await Promise.all([
      getDashboard(supabase),
      getAlerts(supabase),
      getPeople(supabase),
      getActivity(supabase),
      getInstructors(supabase),
    ]);
    return NextResponse.json({
      ...(dashboard.data && !dashboard.error ? { dashboard: dashboard.data } : {}),
      ...(alerts.error ? {} : { alerts: alerts.data }),
      ...(people.error ? {} : { people: people.data }),
      ...(activity.error ? {} : { activity: activity.data }),
      ...(instructors.error ? {} : { instructors: instructors.data }),
      error: dashboard.error ?? alerts.error ?? people.error ?? activity.error ?? instructors.error,
    });
  }

  if (hasRole(profile, "learner")) {
    const { data, error } = await getLearnerEnrollments(createServiceClient(), user.id);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ enrollments: data });
  }

  return NextResponse.json({ error: "Role not recognized" }, { status: 403 });
}
