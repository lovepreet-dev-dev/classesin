import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";

try {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");
} catch { /* env already loaded */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = "Demo123!";

if (!url || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
  process.exit(1);
}

const accounts = [
  ["Maya Patel", "maya@northstar.co"], ["Jon Bell", "jon@northstar.co"], ["Priya Shah", "priya@northstar.co"], ["Owen Brooks", "owen@northstar.co"],
  ["Elena Garcia", "elena@northstar.co"], ["Aarav Mehta", "aarav@northstar.co"], ["Noah Williams", "noah@northstar.co"], ["Sofia Chen", "sofia@northstar.co"],
  ["Liam Okafor", "liam@northstar.co"], ["Mia Thompson", "mia@northstar.co"], ["Lucas Martin", "lucas@northstar.co"], ["Amara Okeke", "amara@northstar.co"],
  ["Theo Nguyen", "theo@northstar.co"], ["Grace Kim", "grace@northstar.co"], ["Mateo Silva", "mateo@northstar.co"], ["Priyanka Rao", "priyanka@northstar.co"],
  ["Ethan Brooks", "ethan@northstar.co"], ["Hana Park", "hana@northstar.co"], ["Caleb Jones", "caleb@northstar.co"], ["Isla Morgan", "isla@northstar.co"],
];

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: existingPage, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;

for (const [fullName, email] of accounts) {
  const existing = existingPage.users.find((user) => user.email?.toLowerCase() === email);
  const result = existing
    ? await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { full_name: fullName } })
    : await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (result.error) throw result.error;
  console.log(`${existing ? "Updated" : "Created"} ${email}`);
}

console.log(`Demo accounts ready. Shared password: ${password}`);
