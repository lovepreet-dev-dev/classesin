# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** https://github.com/lovepreet-dev-dev/classesin
- **Live application:** https://classesin.vercel.app

## Notes for the reviewer

- The login page offers quick-fill for the seeded demo accounts below (all share the password
  `Demo123!`). Sign in as `maya@northstar.co` (instructor) and `elena@northstar.co` (learner) to
  see both role experiences.
- **Five-minute tour:** instructor dashboard (headline metrics, eight-week completions chart,
  inactivity alerts with dismiss) → Courses → type "privacy" into search (server-side, with exact
  total count) → open "Privacy by design" (class roster with per-learner completion status, CSV
  progress export, immutable activity log) → sign out → learner dashboard ("My courses" with
  progress) → open an enrolled course and complete a lesson to watch the state machine and the
  progress bar move.
- **Where the enforced rules live:** `supabase/schema.sql` (row-level security policies, the two
  state-transition triggers, the append-only activity log), `src/app/api/**` (role-checked route
  handlers), `docs/architecture.md` (end-to-end request path), `docs/decisions.md` (the reasoning,
  including two decisions that were later reversed).
- The deployment runs on free tiers and is connected to a Supabase project; if the host has been
  idle, the first request may take up to a minute. Environment setup is documented in
  [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md); secrets are intentionally ignored by Git.
- AI tools were used openly throughout; the actual prompts, including the ones that produced bad
  output and what was changed afterwards, are recorded in [`docs/ai-prompts.md`](./docs/ai-prompts.md).

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Instructor | maya@northstar.co | Demo123! |
| Instructor | jon@northstar.co | Demo123! |
| Instructor | priya@northstar.co | Demo123! |
| Instructor | owen@northstar.co | Demo123! |
| Learner | elena@northstar.co | Demo123! |
| Learner | aarav@northstar.co | Demo123! |
| Learner | noah@northstar.co | Demo123! |
| Learner | sofia@northstar.co | Demo123! |
| Learner | liam@northstar.co | Demo123! |
| Learner | mia@northstar.co | Demo123! |
| Learner | lucas@northstar.co | Demo123! |
| Learner | amara@northstar.co | Demo123! |
| Learner | theo@northstar.co | Demo123! |
| Learner | grace@northstar.co | Demo123! |
| Learner | mateo@northstar.co | Demo123! |
| Learner | priyanka@northstar.co | Demo123! |
| Learner | ethan@northstar.co | Demo123! |
| Learner | hana@northstar.co | Demo123! |
| Learner | caleb@northstar.co | Demo123! |
| Learner | isla@northstar.co | Demo123! |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, Recharts | One language and one deploy for UI and server logic; client components only ever call this app's own API routes |
| Backend | Next.js route handlers | Every read and mutation is role-checked server-side before touching data |
| Database | Supabase (Postgres + Auth) | Row-level security puts authorization in the database; triggers enforce the state machines; free-tier managed hosting |
| Hosting | Vercel + Supabase | Zero-config Next.js deploys from `main`; free tiers on both sides |

## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Complete | Email/password auth; instructor/learner roles enforced three layers deep — route handlers (401/403), RLS policies, and the route guard in `src/proxy.ts`. Learners cannot edit content, enroll others, or read anyone else's progress. |
| 2 | Courses | Complete | Draft creation, editing, archive/restore. Archiving removes the course from the catalogue while lessons and every learner's enrollment history persist. |
| 3 | Lessons | Complete | Each lesson belongs to exactly one course with an ordered position under `unique(course_id, position)`; add, edit, remove, and collision-safe reorder. |
| 4 | States and progress | Complete | DB triggers `validate_course_status_transition` and `validate_progress_transition` reject illegal moves even for callers bypassing the app; publishing an empty course returns 422 with an explanatory message. |
| 5 | Enrollment | Complete | Instructor enrollment, learner self-enrollment, and bulk enrollment; `unique(course_id, learner_id)` makes enrollment idempotent; one "My courses" list with live progress per learner. |
| 6 | Finding courses | Complete | Server-side `ilike` search over titles and descriptions, category/status/instructor filters, sorting by title/creation date/enrollment count, and pagination with the exact total match count. Learners see published courses only — enforced in the route and by RLS. |
| 7 | Bulk enrollment/export | Complete | Per-address results (newly enrolled / already enrolled / unknown address) with race-safe duplicate handling; server-built CSV export covering every enrolled learner. |
| 8 | Dashboard | Complete | SQL counts for the four headline numbers (total learners, published courses, completions this month, currently in progress), breakdowns by course and progress state, and an eight-week completions chart. |
| 9 | History | Complete | Append-only `course_activity_log` — comments are log rows, and no UPDATE/DELETE policy exists for any role, instructor included; there is no mutation endpoint. |
| 10 | Inactivity alerts | Complete | 14-day query over `last_progress_at` with a count badge in the navigation; dismissal stores a snapshot of the progress timestamp so alerts re-appear automatically after renewed activity. |

## How much time did you actually spend?

Approximately 12 hours across setup, schema/auth, course and learner flows, reporting, alert behavior, documentation, and verification.

## What would you do next, with another 12 hours?

Automated integration tests for the state-transition triggers and RLS policies; move catalogue pagination and dashboard aggregates into SQL (`order()/range()`, materialized views); an optional ownership-scoping flag for instructor permissions.

## What are you least happy with in this codebase, and why?

There is no automated test suite — verification was lint, production builds, and repeated full browser end-to-end passes; the transition triggers and RLS policies are exactly the code that deserves regression tests first. Second, catalogue sorting/pagination and dashboard aggregation run in server code rather than SQL `order()/range()` and `group by`; both are correct server-side behavior but re-read all matching rows per request, and the 100× plan for moving them into SQL is documented in `docs/architecture.md`.
