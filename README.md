# Kinship — Course Delivery & Enrollment

Kinship is a course-delivery workspace for internal training teams. Instructors can create and publish learning, see progress, and follow up with inactive learners; learners can discover published courses and track their own work.

This project implements the ten assignment areas: role-based accounts, course and lesson management, lifecycle/progress state rules, many-to-many enrollment, server-side discovery, bulk enrollment and CSV export, instructor dashboard metrics, immutable activity history, and inactivity alerts. Optional stretch features were intentionally left out.

## How it's built

Next.js App Router monolith: client components call this app's own route handlers under `src/app/api`, which own every read and mutation; Supabase Auth holds email/password sessions and Postgres holds the data. Authorization is layered three deep — role checks in the route handlers, row-level security policies in Postgres, and database triggers that reject illegal course/progress state transitions — and the course activity log is append-only by policy, so history cannot be rewritten by any role. See [`docs/architecture.md`](./docs/architecture.md) for the end-to-end request path and [`docs/schema.md`](./docs/schema.md) for every table and constraint.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and sign in with one of the 20 seeded demo accounts — shared password `Demo123!` — listed in [`SUBMISSION.md`](./SUBMISSION.md). The login page also offers one-click fill for a demo instructor and learner. The app requires the Supabase environment variables; there is no offline demo mode.

## Supabase setup

1. Create a Supabase project.
2. Copy [`.env.example`](./.env.example) to [`.env.local`](./.env.local) and replace the publishable key with the project key from Supabase Settings → API Keys. See [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md) if hidden dotfiles are not visible in Finder.
3. Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor.
4. For an existing project, apply the migrations in [`supabase/migrations/`](./supabase/migrations) in filename order: the state-transition guards (`20260903…`), then the security review fixes (`20260925…`). The app's lesson completion, reorder and removal routes call functions the second migration creates.
5. Set `SUPABASE_SERVICE_ROLE_KEY` in your shell and run `npm run seed:demo`. One command creates/resets the 20 demo Auth accounts to `Demo123!` and seeds 18 courses, eight lessons per course, enrollments, completion history, activity entries, and inactivity-ready progress states (the service-role key is never committed). The same seed is also reviewable as SQL in [`supabase/seed.sql`](./supabase/seed.sql).

The server routes in `src/app/api` perform authenticated course queries, learner enrollment, empty-course publish validation, and CSV progress export. Postgres RLS and unique constraints provide a second authorization/data-integrity layer.

## Verification

```bash
npm run lint
npm run build
npm run test:db
```

`npm run test:db` needs Docker. It loads `supabase/schema.sql` and every migration into a throwaway Postgres container and runs 88 checks that sign in as a learner, an instructor and the seed's service role: [`supabase/tests/assignment_rules.sql`](./supabase/tests/assignment_rules.sql) walks the brief's goals (what each role must be able to do, the state machines, enrollment, history, alerts, and the demo-seed reset), and [`supabase/tests/security_review.sql`](./supabase/tests/security_review.sql) tries what each role must not be able to do — read other learners' progress, grant themselves a completion, rewrite or delete history, publish an empty course.

The build uses webpack because the execution environment used for this take-home blocks Turbopack worker ports.

## Deploy on Vercel

Import the GitHub repository with the Vercel project root set to `.`. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as production environment variables (the service-role key backs three audited server-side reads/writes — learner enrollment history, instructor roster reads, and enrollment inserts made on a learner's behalf — and is never exposed to the browser), then deploy the `main` branch. The repository includes [`vercel.json`](./vercel.json) with the install and build commands. Add the resulting Vercel URL to Supabase Auth → URL Configuration and to [`SUBMISSION.md`](./SUBMISSION.md).

## Submission notes

Architecture, schema, implementation plan, decisions, AI-use history, and the reviewer checklist live under [`docs/`](./docs). Public repository and deployment URLs belong in [`SUBMISSION.md`](./SUBMISSION.md) after hosting is configured.
