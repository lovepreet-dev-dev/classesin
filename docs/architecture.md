# Architecture

## The moving pieces and where they run

- **Browser** — Next.js App Router pages (React client components under `src/app`) render the
  instructor workspace, learner "My courses" view, catalogue, dashboard and course detail. Client
  components never touch the database; they only `fetch()` JSON from this app's own API routes and
  render what comes back.
- **Next.js server (Vercel)** — 17 route handlers under `src/app/api/**` own every mutation and
  every read. Each one reads the Supabase session, resolves the caller's role from `profiles`
  (`src/lib/auth.ts`), and returns 401/403/409/422 with an explanatory message before any write
  happens. `src/proxy.ts` (this Next.js version's middleware convention) redirects unauthenticated
  requests to `/login`.
- **Supabase (managed)** — Auth owns email/password sessions; Postgres owns data, constraints and
  row-level security. The app talks to it with two clients: the SSR anon-key client (RLS enforced,
  the default everywhere) and a service-role client (`src/lib/supabase/service.ts`) used in a
  small, audited set of places where RLS would hide or distort legitimate data — the learner
  enrollment list (so archived courses stay visible to enrolled learners), instructor roster reads
  and learner counts on the course page and catalogue (RLS would block reading other learners'
  lesson completions or limit a learner's count embed to their own row), and enrollment inserts
  made on a learner's behalf. Every service-role call site verifies the caller's role server-side
  first; the service key never reaches the browser.
- **Seeding** — `npm run seed:demo` (service-role scripts, deterministic UUIDs) resets a demo
  dataset: 20 accounts, 18 courses × 8 lessons, 42 enrollments with completions and deliberately
  quiet learners so the alerts view has something to show.

## Request path, end to end (mark a lesson complete)

1. Learner clicks Complete on a lesson → `POST /api/progress/complete`.
2. The route reads the session (401 without one) and loads the caller's profile.
3. It verifies the lesson belongs to that course and that the caller owns the enrollment.
4. It inserts the `lesson_completions` row — the `unique(enrollment_id, lesson_id)` constraint
   makes double-completion a caught conflict, not a duplicate.
5. It decides the next progress state. The DB trigger `enrollments_progress_transition_guard`
   only allows `not_started → in_progress → completed`, so a one-lesson course needs a staged
   intermediate update to `in_progress` first; the route performs that legal two-step and sets
   `started_at` / `completed_at` / `last_progress_at`.
6. It appends a `lesson_completed` row to the append-only `course_activity_log`.
7. It returns the updated enrollment, which the client renders as the progress bar.

The same discipline holds everywhere: role check in the route, then RLS as the second gate, then
DB constraints and triggers even if a caller bypasses the app entirely with a raw SQL client.

## The catalogue pipeline

`GET /api/courses` receives `?q=&category=&status=&instructor=&sort=&page=`. The route forces
`status = 'published'` for non-instructors (mirrored by the RLS policy), builds a PostgREST
`or(title.ilike, description.ilike)` for the text query, applies `eq` filters, then sorts and
slices inside the handler and returns `{ data, count }` where `count` is the exact total-match
count behind "Showing x–y of n". Filtering never happens in the browser. The trade-off: sorting
and paging in the handler re-reads all matching rows per request — trivial at this scale; at 100×
the data it would move to SQL `order()/range()` plus `count(head: true)` and a full-text index.

## Deliberately not built

Quizzes, certificates, per-lesson discussion threads, video with watch-progress tracking, ratings,
learning paths, downloadable resources, email digests, and any background scheduler. Inactivity
alerts are a deterministic query over `last_progress_at` plus a dismissal snapshot, so no worker
process is needed. There is no client-side demo fixture either: when the backend is unreachable the
app fails visibly, so every action has exactly one code path through the routes and RLS.
