// Seeds the full demo dataset through the Supabase REST API using the service-role key.
// Mirrors supabase/seed.sql: 20 profiles, 18 courses, 8 lessons per course, enrollments,
// lesson completions, and append-only activity history. Safe to re-run.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
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

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const people = [
  ["Maya Patel", "maya@northstar.co", "instructor"], ["Jon Bell", "jon@northstar.co", "instructor"],
  ["Priya Shah", "priya@northstar.co", "instructor"], ["Owen Brooks", "owen@northstar.co", "instructor"],
  ["Elena Garcia", "elena@northstar.co", "learner"], ["Aarav Mehta", "aarav@northstar.co", "learner"],
  ["Noah Williams", "noah@northstar.co", "learner"], ["Sofia Chen", "sofia@northstar.co", "learner"],
  ["Liam Okafor", "liam@northstar.co", "learner"], ["Mia Thompson", "mia@northstar.co", "learner"],
  ["Lucas Martin", "lucas@northstar.co", "learner"], ["Amara Okeke", "amara@northstar.co", "learner"],
  ["Theo Nguyen", "theo@northstar.co", "learner"], ["Grace Kim", "grace@northstar.co", "learner"],
  ["Mateo Silva", "mateo@northstar.co", "learner"], ["Priyanka Rao", "priyanka@northstar.co", "learner"],
  ["Ethan Brooks", "ethan@northstar.co", "learner"], ["Hana Park", "hana@northstar.co", "learner"],
  ["Caleb Jones", "caleb@northstar.co", "learner"], ["Isla Morgan", "isla@northstar.co", "learner"],
];

const courses = [
  [1, "Security foundations", "Build practical habits for protecting customer data and company systems.", "Compliance", "maya@northstar.co", "published"],
  [2, "Leading with clarity", "A practical workshop for making decisions, giving feedback, and building trust.", "Leadership", "jon@northstar.co", "published"],
  [3, "The manager toolkit", "Rituals and tools for your first 90 days as a people manager.", "Leadership", "priya@northstar.co", "draft"],
  [4, "Customer conversations", "Turn difficult conversations into moments that build lasting relationships.", "Skills", "maya@northstar.co", "published"],
  [5, "Inclusive interviewing", "Create structured, equitable hiring loops that reveal great talent.", "People", "jon@northstar.co", "published"],
  [6, "Remote collaboration", "Design async-first ways of working that keep teams connected.", "Skills", "priya@northstar.co", "archived"],
  [7, "Data literacy essentials", "Use trustworthy data to make better everyday decisions.", "Skills", "owen@northstar.co", "published"],
  [8, "Coaching conversations", "Build confidence through practical coaching habits.", "Leadership", "priya@northstar.co", "published"],
  [9, "Privacy by design", "Make privacy a reliable part of product and process decisions.", "Compliance", "maya@northstar.co", "published"],
  [10, "Facilitation fundamentals", "Plan inclusive meetings that end with clear decisions.", "People", "jon@northstar.co", "draft"],
  [11, "Writing for impact", "Turn complex ideas into clear, useful communication.", "Skills", "owen@northstar.co", "published"],
  [12, "Manager onboarding", "A practical first month for new people leaders.", "Leadership", "jon@northstar.co", "published"],
  [13, "Product discovery", "Explore customer problems and shape better product bets.", "Product", "owen@northstar.co", "published"],
  [14, "Operational excellence", "Create repeatable systems that make good work easier.", "Operations", "priya@northstar.co", "published"],
  [15, "Giving great presentations", "Structure and deliver clear presentations for any audience.", "Communication", "maya@northstar.co", "published"],
  [16, "Responsible AI at work", "Use AI thoughtfully, securely, and transparently in daily work.", "Compliance", "owen@northstar.co", "published"],
  [17, "Hiring manager essentials", "Build a fair, focused process for every new hire.", "People", "priya@northstar.co", "archived"],
  [18, "Customer success playbook", "Turn customer insight into consistent, proactive support.", "Skills", "owen@northstar.co", "published"],
];

const lessonLibrary = [
  ["Start here", "Set the context, goals, and expectations for this learning path."],
  ["Core concepts", "Learn the essential ideas and vocabulary behind the topic."],
  ["A practical framework", "Use a repeatable framework to turn knowledge into action."],
  ["Common scenarios", "Work through realistic examples from everyday team situations."],
  ["Practice in context", "Apply the ideas to a short scenario and compare approaches."],
  ["Tools and templates", "Take away a lightweight tool you can use immediately."],
  ["Reflection", "Pause to connect the learning to your current work and goals."],
  ["Make it stick", "Choose one next step and make a plan to keep the habit going."],
];

// [courseNo, learnerNo, progress, quietDays]
const assignments = [
  [1, 1, "in_progress", 19], [1, 2, "in_progress", 22], [1, 3, "completed", 2], [1, 4, "in_progress", 4], [1, 5, "not_started", null],
  [2, 1, "not_started", null], [2, 6, "in_progress", 5], [2, 7, "completed", 3], [2, 8, "in_progress", 16],
  [4, 1, "completed", 2], [4, 9, "in_progress", 15], [4, 10, "in_progress", 6], [4, 11, "not_started", null],
  [5, 2, "in_progress", 3], [5, 4, "completed", 4], [5, 12, "not_started", null],
  [7, 3, "in_progress", 5], [7, 5, "completed", 2], [7, 13, "in_progress", 18],
  [8, 6, "completed", 1], [8, 14, "in_progress", 8], [8, 15, "not_started", null],
  [9, 7, "in_progress", 16], [9, 8, "completed", 2], [9, 16, "in_progress", 3],
  [11, 9, "completed", 2], [11, 10, "in_progress", 5], [11, 11, "not_started", null],
  [12, 12, "in_progress", 4], [12, 13, "completed", 1], [12, 14, "not_started", null],
  [13, 15, "in_progress", 7], [13, 16, "completed", 3], [14, 1, "in_progress", 17], [14, 5, "completed", 2],
  [15, 2, "not_started", null], [15, 6, "in_progress", 5], [16, 3, "in_progress", 22], [16, 7, "completed", 2],
  [18, 4, "in_progress", 6], [18, 8, "completed", 1], [18, 12, "not_started", null],
];

const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
const courseUuid = (no) => `10000000-0000-0000-0000-${String(no).padStart(12, "0")}`;
const enrollmentUuid = (courseNo, learnerNo) => createHash("md5").update(`${courseNo}:${learnerNo}`).digest("hex");

async function ensureAuthUsers() {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const known = new Map((data.users ?? []).filter((user) => user.email).map((user) => [user.email.toLowerCase(), user.id]));
  for (const [, email] of people) {
    if (known.has(email)) continue;
    const name = people.find((row) => row[1] === email)?.[0] ?? email;
    const { data: created, error: createError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
    if (createError) throw createError;
    known.set(email, created.id);
    console.log(`Created auth account ${email}`);
  }
  return known;
}

async function clearTable(table) {
  const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`Clearing ${table}: ${error.message}`);
}

async function run() {
  const authIds = await ensureAuthUsers();

  // Remove any stale/partial demo data so the seed below is the single source of truth.
  await clearTable("enrollment_requests");
  await clearTable("lesson_completions");
  await clearTable("alert_dismissals");
  await clearTable("enrollments");
  await clearTable("course_activity_log");
  await clearTable("lessons");
  await clearTable("courses");

  // Profiles resolve their IDs from the Auth accounts by email.
  const profileRows = people.map(([fullName, email, role]) => ({ id: authIds.get(email), full_name: fullName, email, role }));
  const { error: profileError } = await supabase.from("profiles").upsert(profileRows, { onConflict: "id" });
  if (profileError) throw new Error(`Profiles: ${profileError.message}`);

  const profileByEmail = new Map(profileRows.map((row) => [row.email, row.id]));
  const { error: courseError } = await supabase.from("courses").upsert(
    courses.map(([no, title, description, category, instructorEmail, status]) => ({
      id: courseUuid(no), title, description, category, instructor_id: profileByEmail.get(instructorEmail),
      status, published_at: status === "published" ? daysAgo(30) : null,
      archived_at: status === "archived" ? daysAgo(22) : null,
    })),
    { onConflict: "id" },
  );
  if (courseError) throw new Error(`Courses: ${courseError.message}`);

  const lessonRows = courses.flatMap(([no, , , , , ,]) => lessonLibrary.map(([title, content], index) => ({
    course_id: courseUuid(no), title: `${title}: ${courses.find((row) => row[0] === no)[1]}`, content, position: index + 1,
  })));
  const { error: lessonError } = await supabase.from("lessons").upsert(lessonRows, { onConflict: "course_id,position", ignoreDuplicates: true });
  if (lessonError) throw new Error(`Lessons: ${lessonError.message}`);

  const { data: lessonIds, error: lessonReadError } = await supabase.from("lessons").select("id,course_id,position");
  if (lessonReadError) throw lessonReadError;
  const lessonsByCourse = new Map();
  for (const lesson of lessonIds ?? []) {
    if (!lessonsByCourse.has(lesson.course_id)) lessonsByCourse.set(lesson.course_id, []);
    lessonsByCourse.get(lesson.course_id).push(lesson);
  }

  const learnerByEmail = new Map(profileRows.filter((row) => row.email).map((row) => [row.email, row]));
  const learnerNumbers = new Map(people.filter((row) => row[2] === "learner").map((row, index) => [index + 1, row[1]]));

  const enrollmentRows = assignments.map(([courseNo, learnerNo, progress, quietDays]) => {
    const email = learnerNumbers.get(learnerNo);
    return {
      id: enrollmentUuid(courseNo, learnerNo),
      course_id: courseUuid(courseNo),
      learner_id: learnerByEmail.get(email).id,
      progress,
      enrolled_at: daysAgo((quietDays ?? 4) + 5),
      started_at: progress === "not_started" ? null : daysAgo((quietDays ?? 4) + 3),
      completed_at: progress === "completed" ? daysAgo(quietDays ?? 2) : null,
      last_progress_at: progress === "not_started" ? null : daysAgo(quietDays ?? 2),
    };
  });
  const { error: enrollmentError } = await supabase.from("enrollments").upsert(enrollmentRows, { onConflict: "course_id,learner_id", ignoreDuplicates: true });
  if (enrollmentError) throw new Error(`Enrollments: ${enrollmentError.message}`);

  const completionRows = enrollmentRows.flatMap((enrollment) => {
    if (enrollment.progress === "not_started") return [];
    const lessons = lessonsByCourse.get(enrollment.course_id) ?? [];
    return lessons
      .filter((lesson) => enrollment.progress === "completed" || lesson.position <= 3)
      .map((lesson) => ({ enrollment_id: enrollment.id, lesson_id: lesson.id, completed_at: enrollment.last_progress_at }));
  });
  const { error: completionError } = await supabase.from("lesson_completions").upsert(completionRows, { onConflict: "enrollment_id,lesson_id", ignoreDuplicates: true });
  if (completionError) throw new Error(`Lesson completions: ${completionError.message}`);

  const requestRows = [
    { course_id: courseUuid(5), learner_id: learnerByEmail.get("elena@northstar.co").id, status: "pending" },
    { course_id: courseUuid(9), learner_id: learnerByEmail.get("grace@northstar.co").id, status: "pending" },
    {
      course_id: courseUuid(7),
      learner_id: learnerByEmail.get("mateo@northstar.co").id,
      status: "rejected",
      decided_at: daysAgo(2),
      decided_by: profileByEmail.get("owen@northstar.co"),
    },
  ];
  const { error: requestError } = await supabase.from("enrollment_requests").insert(requestRows);
  if (requestError && requestError.code !== "PGRST205") throw new Error(`Enrollment requests: ${requestError.message}`);

  const activityRows = courses.map(([no, , , , instructorEmail, status]) => ({
    course_id: courseUuid(no),
    actor_id: profileByEmail.get(instructorEmail),
    event: status === "published" ? "published" : status === "archived" ? "archived" : "created",
    message: status === "published" ? "Course published" : status === "archived" ? "Course archived" : "Course created",
  }));
  activityRows.push({
    course_id: courseUuid(1), actor_id: learnerByEmail.get("elena@northstar.co").id, event: "commented",
    message: "The examples in this module were very helpful.",
  });
  const { error: activityError } = await supabase.from("course_activity_log").insert(activityRows);
  if (activityError) throw new Error(`Activity log: ${activityError.message}`);

  const [{ count: profileCount }, { count: courseCount }, { count: lessonCount }, { count: enrollmentCount }, { count: completionCount }, { count: activityCount }] =
    await Promise.all(["profiles", "courses", "lessons", "enrollments", "lesson_completions", "course_activity_log"].map(async (table) => {
      const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
      return { count };
    }));

  console.log(`Seed complete: ${profileCount} profiles, ${courseCount} courses, ${lessonCount} lessons, ${enrollmentCount} enrollments, ${completionCount} lesson completions, ${activityCount} activity rows.`);
}

run().catch((error) => { console.error(error); process.exit(1); });
