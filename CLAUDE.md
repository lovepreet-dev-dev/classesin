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

All committed (`main` @ be05cda) and E2E-verified in the browser:
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

## IN FLIGHT — enrollment request workflow (do this next)

The user is replacing instant learner self-enrollment with a request/approve flow, plus an
instructor roster. The migration file is written; ALL feature code below is NOT yet written.

1. **Migration PENDING USER ACTION**: `supabase/migrations/20260904000000_enrollment_requests.sql`
   creates `enrollment_requests` (status enum pending/approved/rejected, partial unique index so
   only one pending request per (course, learner), RLS: learner inserts/selects own, course-owner
   selects/updates) and adds activity enum values `enrollment_requested`, `enrollment_rejected`
   (ALTER TYPE … ADD VALUE cannot run in a transaction — if the SQL editor complains, run those two
   lines separately). Verify it landed with:
   `curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/enrollment_requests?select=*&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"`
   (PGRST205 = not applied; 200/empty array = applied). Then append the same DDL to the tail of
   `supabase/schema.sql` so fresh setups get it, and update `docs/schema.md`.
2. **New route** `src/app/api/enrollments/requests/route.ts`:
   - POST (learner): request enrollment in a published course. Reject 409 if already enrolled or a
     pending request exists. Insert via authenticated client (RLS allows). Log
     `enrollment_requested` activity via service client (wrap in try/catch in case enum additions
     were skipped).
   - GET (role-dependent): learner → own requests incl. course titles; instructor → requests for
     courses they own (`course.instructor_id = user.id`), default `?status=pending`.
   - PATCH (instructor): `{ requestId, decision: "approved" | "rejected" }`. Verify request is
     pending AND user owns the course (the course's instructor decides). Approve: insert enrollment
     via service client (treat 23505 as already-enrolled), mark request approved + decided_by/
     decided_at, log `enrolled` activity. Reject: mark rejected, log `enrollment_rejected`.
3. **Progress marking for instructors**: extend `src/app/api/progress/complete/route.ts` — accept
   optional `learnerId`; when present and ≠ caller, require instructor role and use the service
   client (RLS only lets learners touch their own rows). Mirror the existing transition logic incl.
   the not_started→in_progress intermediate update. Log `lesson_completed` with actor = instructor
   and message naming the learner. Return the same `{ ...enrollment, progress }` shape.
4. **`POST /api/enrollments`**: learners must no longer self-enroll directly — return a 4xx with a
   clear "request enrollment instead" message when `body.learnerId` is absent; instructor direct
   enrollment (with `learnerId`) stays.
5. **Course detail** `src/app/courses/[courseId]/page.tsx`: instructor branch fetches (service
   client) the roster — `enrollments(id, progress, enrolled_at, last_progress_at,
   profiles!enrollments_learner_id_fkey(id,full_name,email), lesson_completions(lesson_id))` — and
   pending requests; learner branch fetches own latest request status (pending/rejected) via the
   authenticated client (RLS covers it). Pass roster/pendingRequests/myRequestStatus to the client.
6. **Rewrite `course-detail-client.tsx` cleanly** (currently dense single-line JSX — user wants
   readable multi-line JSX and better UI): learner CTA becomes "Request to enroll" with states
   (pending → disabled "Request pending"; rejected → "Request declined" + allow re-request);
   instructor side gets an Enrollment Requests panel (accept/reject buttons) and a Roster panel
   (each enrolled learner: avatar, name, email, progress badge, "x/y lessons", last active); clicking
   a learner opens a modal listing course lessons with per-lesson "Mark complete" buttons and
   "Mark all complete" — completion must be reflected in the student's own dashboard (it happens
   automatically because lesson_completions + enrollment progress rows are updated; last_progress_at
   also refreshes, which correctly clears inactivity alerts). After decisions, update local state
   and call `router.refresh()`. Keep the direct "Enroll a learner" box (instructors still enroll
   learners without a request) and the existing comments/lessons/CSV-export features.
7. **Learner catalog** `src/app/workspace-client.tsx`: fetch own requests, show "Requested"/
   "Enrolled" chips on catalog course cards. Nav "Activity" tab titles map
   (`src/app/api/activity/route.ts` eventTitles) should include the new events.
8. **Seed additions** (in `scripts/seed-demo-data.mjs`, plus apply the rows via REST now WITHOUT
   rerunning the full wipe): Elena requests Inclusive interviewing (Jon, pending); Grace requests
   Privacy by design (Maya, pending); Mateo requests Data literacy essentials (Owen, rejected).
9. **Suspected bug to re-verify** (user report): "Elena enrolled in a course, it showed in activity
   but not on her dashboard." Likely cause: user tested the stale Vercel deploy (old code with demo
   fallbacks), but verify locally: fresh enroll → return to overview → enrolledCourses refetches on
   mount (effect deps `[isInstructor]`). If it still fails, dig into `/api/enrollments` GET.
10. Then: `npm run lint && npm run build`, full browser E2E of request → approve → learner dashboard
    shows course; reject path; roster; instructor mark-all-complete → student dashboard shows
    Completed. Commit in logical chunks (style below), no AI attribution.

## Conventions (user-enforced)

- Commits: `type: lowercase summary` + optional body, matching `git log` (feat:/fix:/data:/chore:/docs:).
  Logical chunks only. **Never mention AI / no Co-Authored-By lines.** Do not commit unless asked.
- No code comments unless asked. TypeScript strict; `npm run lint` must be clean.
- UI: warm paper palette, CSS vars in globals.css (--coral, --lavender…); page-specific styles live
  as minified one-liners appended to `src/app/enhancements.css`. Reuse existing classes
  (panel, button-primary/secondary, badge, avatar, icon-button, modal, detail-*).
- docs/ (architecture.md, schema.md, plan.md, decisions.md, ai-prompts.md) are graded submission
  artifacts — keep them truthful when schema/behavior changes.
