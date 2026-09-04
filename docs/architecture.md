# Architecture

## What this is

Kinship is an internal training platform: instructors build courses out of ordered lessons and
publish them; learners self-enroll in published courses and work through them at their own pace;
progress is tracked automatically, and instructors can see at a glance who finished, who is
halfway, and who went quiet. The brief's hardest requirement — role differences must be enforced
on the server, not hidden in the interface — is what shaped everything below.

## The moving pieces, and why they are arranged this way

**The browser never touches the database.** Next.js App Router pages render the instructor
workspace, the learner catalogue and dashboard, and the course detail screen. The client
components are pure interaction: they fetch JSON from this app's own API routes and render the
result. There is no database query in client code and no service-role key anywhere near the
bundle. This is the first enforcement boundary — nothing sensitive can leak through the client
because nothing sensitive is in it.

**One API surface owns every read and write.** Seventeen route handlers under `src/app/api/**`
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
3. It verifies the lesson belongs to that course and that the caller owns the enrollment.
4. It inserts the `lesson_completions` row. The `unique(enrollment_id, lesson_id)` constraint
   turns a double-click into a caught conflict instead of a duplicate record.
5. It computes the next progress state. The database trigger
   `enrollments_progress_transition_guard` only allows `not_started → in_progress → completed`,
   so a one-lesson course cannot jump straight from `not_started` to `completed`: the handler
   performs the legal intermediate `in_progress` update first, then sets `completed_at` and
   refreshes `last_progress_at`. This two-step looks odd and is worth defending — the rule lives
   in the database where it cannot be broken, so the application has to speak the database's
   legal vocabulary rather than the other way round.
6. It appends a `lesson_completed` row to `course_activity_log`, which is append-only by policy.
7. It returns the updated enrollment; the client re-renders the progress bar.

The same shape repeats everywhere: a check in the handler, the same rule re-enforced in RLS, and
a third enforcement in constraints and triggers. If someone bypasses the app with a raw SQL
client, the first layer disappears — the second and third do not.

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

Vercel deploys `main` on every push; `vercel.json` pins the install and build commands. Three
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
