# Architecture

## What this is

Kinship is an internal training platform: instructors build courses out of ordered lessons and
publish them; learners self-enroll in published courses and work through them at their own pace;
progress is tracked automatically, and instructors can see at a glance who finished, who is
halfway, and who went quiet. The brief's hardest requirement — role differences must be enforced
on the server, not hidden in the interface — is what shaped everything below.

## The moving pieces, and why they are arranged this way

**The browser reads and writes data only through this app's routes — but it holds a live
Supabase session.** Next.js App Router pages render the instructor workspace, the learner
catalogue and dashboard, and the course detail screen. The client components fetch JSON from
this app's own API routes and render the result; there is no data query in client code and no
service-role key anywhere near the bundle. Sign-in is the exception: the login page calls
Supabase Auth directly, so the browser ends up with a session and the public anon key. That
session can call Supabase's REST API without going through the routes at all. I originally
wrote this paragraph as "the browser never touches the database" and treated the routes as the
first wall; a post-submission review showed that was the wrong mental model. The routes give
good messages and status codes, but row-level security is the boundary that actually has to
hold on its own — which is what the security review migration fixed (see *Where the rules
really live* below).

**One API surface owns every read and write.** Eighteen route handlers under `src/app/api/**`
are the only code that talks to Postgres. Every handler follows the same discipline: read the
session, resolve the caller's role from `profiles` (`src/lib/auth.ts`), and refuse with a real
status code and a human-readable message *before* anything is written — 401 unauthenticated, 403
wrong role, 409 illegal move or duplicate, 422 business rule (publishing an empty course, for
example). Centralizing data access here means there is exactly one place to check, one place to
log, and one place to test. `src/proxy.ts` — the middleware convention in this Next.js version —
redirects unauthenticated navigation to `/login` before pages even render, so the route handlers
never have to wonder whether a page-level check was forgotten.

**Supabase runs the parts I did not want to run myself.** Auth owns email/password sessions;
Postgres owns data, constraints, row-level security, and the state-machine triggers. The app
talks to it through two clients:

- the SSR anon-key client, the default everywhere. Every query under this client runs through
  row-level security, so the database itself refuses rows the caller may not see. This matters
  beyond correctness: it means authorization survives even a future second client (a script, a
  mobile app, an intern's weekend experiment) that calls the database directly.
- a service-role client (`src/lib/supabase/service.ts`) that bypasses RLS, used only where RLS
  would hide or distort legitimate data. There are four audited call sites, and each exists
  because a real requirement ran into a real RLS limitation: the learner enrollment list (RLS
  hides archived courses, but a learner still enrolled in one must keep seeing it in "My
  courses"), instructor roster reads on the course page (RLS lets learners read only their own
  lesson completions, but the roster needs every student's counts), catalogue learner counts and
  instructor names for non-instructors (RLS limits a learner's count embed to their own row —
  which rendered as 0 or 1 — and hides the instructor's profile row, which rendered as "By
  Kinship"), and enrollment inserts made on a learner's behalf. Every call site verifies the
  caller's role server-side first. The service key never reaches the browser.

**Seeding.** `npm run seed:demo` resets a deterministic demo dataset through the service-role
scripts: 20 accounts, 18 courses × 8 lessons, enrollments with completions and deliberately
quiet learners so the alerts view has something to show. Fixed UUIDs keep every test run
comparable — the same course id means the same course on every machine.

## A request path, end to end: marking a lesson complete

1. The learner clicks Complete → `POST /api/progress/complete` with the lesson id.
2. The handler reads the session (401 without one) and loads the caller's profile.
3. It calls the Postgres function `complete_lesson(lesson_id)` through `supabase.rpc`. Everything
   below runs inside that one function, so it is a single transaction: if any step fails, none of
   it happened.
4. The function resolves the caller from the session (`auth.uid()`), checks the lesson belongs
   to a published course, and loads the caller's enrollment in that course with `FOR UPDATE`.
   The row lock matters: two Complete clicks on the last two lessons used to run in parallel,
   each counted "one lesson left", and the learner finished every lesson but stayed In
   Progress. Now the second request waits for the first and sees its completion.
5. It inserts the `lesson_completions` row. The `unique(enrollment_id, lesson_id)` constraint
   turns a double-click into a 409 instead of a duplicate record.
6. It computes the next progress state. The trigger `enrollments_progress_transition_guard` only
   allows `not_started → in_progress → completed`, so the first completion always passes through
   `in_progress` — even on a one-lesson course, where the function performs both updates back to
   back. The rule lives in the database, so the code has to speak the database's legal
   vocabulary rather than the other way round.
7. It appends a `lesson_completed` row to `course_activity_log` and returns the enrollment.
8. The route maps any error to a status: the function raises SQLSTATE `KN404`, `KN409` and so on,
   where the digits are the HTTP status (`src/lib/db-errors.ts`). The client re-renders the
   progress bar.

The function is `SECURITY DEFINER` because learners no longer hold any write permission on
`enrollments` or `lesson_completions` — completing a lesson through this function is the only
way their progress can move. It does its own identity and ownership checks for that reason.

## Where the rules really live

Every rule has a friendly check in the route handler, but the database enforces it on its own,
because a signed-in browser can reach the REST API directly:

- **Roles and visibility** — RLS on all seven tables. Learners see published courses, their own
  enrollments and completions, and — for courses they are enrolled in — course-level events,
  comments and their own events in the activity log. Never another learner's progress.
- **State machines** — triggers reject illegal course and progress transitions, and publishing
  a draft with no lessons is rejected in the same trigger (goal 4). Restoring an archived course
  and removing lessons are not restricted beyond what the brief asks (goals 2 and 3).
- **No self-granted progress** — a new enrollment must start at `not_started` in a published
  course, and there is no UPDATE policy on enrollments for anyone; progress changes only inside
  `complete_lesson`.
- **History** — the activity log has SELECT and INSERT policies only, application roles hold no
  UPDATE or DELETE privilege on it, and its foreign key is `ON DELETE RESTRICT`, so deleting a
  course cannot cascade the history away. Instructors have no DELETE policy on courses.
- **Multi-step writes** — lesson completion, reorder and removal are Postgres functions, one
  transaction each.

`npm run test:db` checks each of these by signing in as a learner and an instructor against a
throwaway Postgres and attempting what each role must not do.

## The catalogue pipeline

`GET /api/courses` takes `q`, `category`, `status`, `instructor`, `sort`, and `page`. The handler
forces `status = 'published'` for non-instructors (the RLS policy mirrors this — the route is the
politeness, the policy is the law), builds a PostgREST `or(title.ilike.*, description.ilike.*)`
for the text query after stripping `(` and `)` from the input so a crafty search term cannot
inject filter syntax, applies `eq` filters, then sorts and slices inside the handler and returns
`{ data, count }` where `count` is the exact total-match count behind "Showing 1–10 of 37".

Honest trade-off: sorting and paging in the handler re-reads every matching row per request.
Nothing is filtered in the browser — that is what the brief demands — and at this dataset size
it is instantaneous. But it is the first thing I would move into SQL (`order()`/`range()` plus
`count(head: true)`) if the catalogue grew; `docs/schema.md` works through exactly why.

## Deployment and configuration

Vercel deploys `main` on every push; `vercel.json` pins the install and build commands and pins
the function region to `bom1` (Mumbai) so the serverless functions sit next to the Supabase
project and its users — with the default US region, every request paid a transoceanic round trip
and the workspace took multiple seconds to mount. Three
environment variables are required in production: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The last one backs the audited
service-role reads and writes described above — and when it is missing, those paths fail silently
empty rather than loudly, which is exactly what happened once during development: learner
dashboards rendered without their enrollment list until the variable was added. That incident is
also why the deployment was verified end to end in the browser afterwards.
`npm run seed:demo` resets the demo dataset through the service-role scripts; it wipes and
reseeds courses, lessons, enrollments, completions, and activity, so it is a reset button rather
than an idempotent top-up.

## Deliberately not built

Quizzes, certificates, per-lesson discussion threads, video with watch-progress tracking, ratings,
learning paths, downloadable resources, email digests, and any background scheduler. Inactivity
alerts are a deterministic query over `last_progress_at` plus a dismissal snapshot, so no worker
process is needed. There is no client-side demo fixture either: when the backend is unreachable
the app fails visibly, so every action has exactly one code path through the routes and RLS.
