import { createClient } from "@/lib/supabase/server";

export type AppRole = "instructor" | "learner";

/** Resolve the current Supabase session and application profile on the server. */
export async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id,full_name,email,role").eq("id", user.id).maybeSingle();
  return { supabase, user, profile };
}

export function hasRole(profile: { role?: string } | null, role: AppRole) {
  return profile?.role === role;
}
