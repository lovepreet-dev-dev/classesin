# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** https://github.com/lovepreet-dev-dev/classesin
- **Live application:** https://classesin.vercel.app

## Notes for the reviewer

The production Vercel deployment is live at the URL above and is connected to the `classesin` Supabase project. The seed contains 18 courses, eight lessons per course, four instructors, and 16 learners. Run `npm run seed:demo` with a Supabase service-role key to create/reset the demo Auth accounts and apply the full demo dataset in one step. If the free host sleeps, the first request may take a minute. Environment setup is documented in [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md); secrets are intentionally ignored by Git.

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
| Frontend | Next.js, TypeScript, Tailwind | Fast full-stack UI |
| Backend | Next.js server routes | Server-side authorization and queries |
| Database | Supabase Postgres/Auth | Managed relational data and sessions |
| Hosting | Vercel + Supabase | Free-tier deployment |

## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Complete | Supabase email/password login, role profiles, proxy guard, server role checks, and RLS. |
| 2 | Courses | Complete | Instructor draft creation, publish validation, archive/restore lifecycle, and audit events. |
| 3 | Lessons | Complete | Eight seeded lessons per course plus add, edit, remove, and collision-safe reorder controls. |
| 4 | States and progress | Complete | Database trigger guards plus server validation for course/progress transitions and lesson completion. |
| 5 | Enrollment | Complete | Learner self-enrollment, instructor enrollment, unique constraint, and duplicate handling. |
| 6 | Finding courses | Complete | Server-side query/search/category/status filters, ordering, pagination, and learner visibility via RLS. |
| 7 | Bulk enrollment/export | Complete | Per-email bulk results and instructor-authorized CSV progress export. |
| 8 | Dashboard | Complete | Server-backed metrics, course/progress breakdown data, and eight-week completion chart. |
| 9 | History | Complete | Append-only activity table, comments, lifecycle/progress/enrollment events, and activity view. |
| 10 | Inactivity alerts | Complete | 14-day server query with snapshot dismissal and automatic reappearance after progress. |

## How much time did you actually spend?

Approximately 12 hours across setup, schema/auth, course and learner flows, reporting, alert behavior, documentation, and verification.

## What would you do next, with another 12 hours?

Add automated Supabase integration tests and move dashboard aggregate metrics to database views as data grows.

## What are you least happy with in this codebase, and why?

The overview still keeps a small deterministic fallback fixture so the UI remains reviewable if Supabase is temporarily unavailable; authenticated requests use the server routes and RLS-backed data path.
