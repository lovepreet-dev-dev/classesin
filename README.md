# Kinship — Course Delivery & Enrollment

Kinship is a course-delivery workspace for internal training teams. Instructors can create and publish learning, see progress, and follow up with inactive learners; learners can discover published courses and track their own work.

This project implements the ten assignment areas: role-based accounts, course and lesson management, lifecycle/progress state rules, many-to-many enrollment, server-side discovery, bulk enrollment and CSV export, instructor dashboard metrics, immutable activity history, and inactivity alerts. Optional stretch features were intentionally left out.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The dashboard includes deterministic demo data so the interface can be reviewed without credentials. The `/login` page is ready for Supabase email/password authentication.

## Supabase setup

1. Create a Supabase project.
2. Copy [`.env.example`](./.env.example) to [`.env.local`](./.env.local) and replace the publishable key with the project key from Supabase Settings → API Keys. See [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md) if hidden dotfiles are not visible in Finder.
3. Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor.
4. For an existing project, apply the incremental guard migration in [`supabase/migrations/20260903000000_state_transition_guards.sql`](./supabase/migrations/20260903000000_state_transition_guards.sql).
5. Create the demo Auth users and replace the UUID placeholders in [`supabase/seed.sql`](./supabase/seed.sql), then run the seed.

The server routes in `src/app/api` perform authenticated course queries, learner enrollment, empty-course publish validation, and CSV progress export. Postgres RLS and unique constraints provide a second authorization/data-integrity layer.

## Verification

```bash
npm run lint
npm run build
```

The build uses webpack because the execution environment used for this take-home blocks Turbopack worker ports.

## Submission notes

Architecture, schema, implementation plan, decisions, AI-use history, and the reviewer checklist live under [`docs/`](./docs). Public repository and deployment URLs belong in [`SUBMISSION.md`](./SUBMISSION.md) after hosting is configured.
