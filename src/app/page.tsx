import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import WorkspaceClient from "./workspace-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user, profile } = await getAuthContext();
  if (!user) redirect("/login");
  const fullName = profile?.full_name ?? user.email ?? "Workspace member";
  return (
    <WorkspaceClient
      profile={{
        id: profile?.id ?? user.id,
        fullName,
        email: profile?.email ?? user.email ?? "",
        role: profile?.role === "instructor" ? "Instructor" : "Learner",
      }}
    />
  );
}
