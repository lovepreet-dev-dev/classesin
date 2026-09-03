@AGENTS.md

# Project handoff — classesin (Kinship course-delivery app)

Read this file fully before changing anything. It is the complete working context.

## What this is

Assignment 05 "Course Delivery & Enrollment" take-home (see `ASSIGNMENT/README.md` — 10 required
goals, all implemented and verified). Stack: Next.js 16.3.4 (App Router, src/ dir), TypeScript,
Tailwind v4, Supabase (hosted Postgres + Auth), deployed on Vercel at https://classesin.vercel.app.

Branding in the UI is "Kinship". Repo: https://github.com/lovepreet-dev-dev/classesin

## CRITICAL environment facts

- Secrets live in `.env.local` (gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`. Never print or commit these.
- Supabase project ref: `ziptpkwfwleedotiquyf`.
- **No DDL access**: the REST API cannot create tables/enum types, `/pg/v1/query` returns 404,
  and the direct DB host is unreachable. Applying `supabase/migrations/*.sql` requires the user to
  paste the SQL into Supabase Dashboard → SQL Editor. Always verify a migration actually landed
  before testing features that depend on it (quick check below).
- Node 22, npm. `npm run dev` (port 3000 may be occupied by another app — Next.js auto-picks 3001).
  `npm run lint`, `npm run build` (build uses `--webpack` flag; both must pass before committing).
- This Next.js version differs from older training data. Before touching framework APIs read the
  bundled docs in `node_modules/next/dist/docs/`. `src/proxy.ts` is the middleware convention here.

## Demo data & seeding

- 20 demo accounts, shared password `Demo123!` — 4 instructors
  (maya@, jon@, priya@, owen@northstar.co) and 16 learners (elena@, aarav@, noah@, sofia@, liam@,
  mia@, lucas@, amara@, theo@, grace@, mateo@, priyanka@, ethan@, hana@, caleb@, isla@northstar.co).
  Full table lives in `SUBMISSION.md`.
- `npm run seed:demo` = `scripts/seed-demo-users.mjs` (auth accounts, idempotent) +
  `scripts/seed-demo-data.mjs` (profiles + 18 courses × 8 lessons + 42 enrollments + completions +
  activity, via service-role REST, deterministic fixed UUIDs `10000000-…-0001…0018`).
- **WARNING**: `seed-demo-data.mjs` WIPES courses/lessons/enrollments/completions/activity before
  reseeding. Do not run it casually — it destroys user-created test data. It is a reset button.
- Current live DB (after user testing): 20 profiles, 18 courses, ~45 enrollments, 33 activity rows.

## Verified-working state (as of this handoff)

All committed (`main` @ ecc19c6) and E2E-verified in the browser:
- Login for every role; workspace renders the signed-in user's name/role (no hardcoded profile).
- Instructor dashboard: live metrics (16 learners, 14 published), 8-week completions chart,
  per-course/progress breakdowns, 7 seeded inactivity alerts with snapshot-dismissal.
- Learner dashboard: "My courses" with progress, stats cards; catalog shows only published courses.
- Courses: create draft, publish (server rejects empty course with message), archive/restore.
- Lessons: add/edit/remove/reorder (collision-safe two-phase reposition).
- Bulk enroll: per-address results (newly/already/unknown), any instructor → any published course.
- CSV progress export: `GET /api/export/[courseId]` + button on course detail.
- Learner lesson completion walks Not Started → In Progress → Completed (DB trigger guards the
  state machine; 1-lesson courses need an intermediate in_progress update — handled in
  `/api/progress/complete`).
- Server-side search/category/status/instructor filters, sort, pagination with total count.
- RLS is the second auth layer; a few reads use `src/lib/supabase/service.ts` (service-role client,
  bypasses RLS) where policies would hide legitimate data — every such call site verifies role
  server-side first. Existing uses: learner enrollment list (so archived courses stay visible),
  instructor roster reads on the course page (RLS would block reading other learners'
  lesson_completions), enrollment inserts made on a learner's behalf.

## Reverted experiment — do not rebuild

A learner enrollment-request workflow (request/approve instead of instant self-enrollment, plus an
instructor roster and per-learner completion marking) was built, then fully reverted: f4c0c54 added
it, f8afe0f reverted it, 4999ba3 dropped its migration. The brief's goal 5 specifies instant
self-enrollment, so the approval flow was scope creep. Schema, migrations, `src/`, and
`docs/schema.md` are clean of it; the reasoning is recorded in `docs/decisions.md` (Decision 6).

## Conventions (user-enforced)

- Commits: `type: lowercase summary` + optional body, matching `git log` (feat:/fix:/data:/chore:/docs:).
  Logical chunks only. **Never mention AI / no Co-Authored-By lines.** Do not commit unless asked.
- No code comments unless asked. TypeScript strict; `npm run lint` must be clean.
- UI: warm paper palette, CSS vars in globals.css (--coral, --lavender…); page-specific styles live
  as minified one-liners appended to `src/app/enhancements.css`. Reuse existing classes
  (panel, button-primary/secondary, badge, avatar, icon-button, modal, detail-*).
- docs/ (architecture.md, schema.md, plan.md, decisions.md, ai-prompts.md) are graded submission
  artifacts — keep them truthful when schema/behavior changes.
