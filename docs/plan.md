# Plan

## How the twelve hours were split

The work ran in seven sessions, ordered by dependency rather than by the order goals appear in
the brief: nothing can be tested without an identity, nothing can be safely built before the
constraints exist, and reporting is only worth building once there is real behavior to report on.

1. **Foundation and auth** — repo wiring (Next.js App Router, Supabase, Tailwind), email/password
   login, the `profiles` table, and the middleware route guard. Estimate 1.5h.
2. **Schema and authorization** — all seven tables, the four enums, the uniqueness constraints,
   the RLS policy set, and the two state-machine triggers. This was the riskiest and most
   load-bearing session; doing it second meant every later feature inherited correct enforcement
   instead of retrofitting it. Estimate 2h.
3. **Instructor tools** — course CRUD with draft defaults, lessons with ordered positions and
   collision-safe reorder, publish validation, archive/restore. Estimate 2h.
4. **Learner flows** — catalogue visibility rules, self-enrollment, the "My courses" list, lesson
   completion through the state machine, progress timestamps. Estimate 2h.
5. **Discovery, bulk tools, export** — server-side search/filters/sort/pagination with exact
   total counts, bulk enrollment with per-address results, CSV progress export. Estimate 1.5h.
6. **Dashboard and alerts** — the four headline metrics, per-course and per-progress breakdowns,
   the eight-week chart, and inactivity detection with snapshot dismissal. Estimate 1.5h.
7. **Verification, deployment, documentation** — Vercel deploy, the demo seed, end-to-end passes,
   and the graded docs. Estimate 1.5h.

Actual time landed at roughly the twelve-hour estimate; the estimates per session were honest
guesses that each drifted by less than half an hour, with session 2 (schema and authorization)
running long and session 5 running short — which is the trade I would make again, because the
enforcement layer is the part the brief grades hardest.

The dependency order also made verification reproducible: every later flow could be exercised
against the schema and the seeded identities the earlier sessions created, and the deterministic
demo seed (fixed UUIDs, one reset command) meant a broken test state was always one command away
from a clean slate.

## What was deliberately cut

Quizzes, certificates, video delivery with watch-progress, discussion threads, ratings, learning
paths, downloadable resources, email notifications, and a background scheduler for alerts. These
are the brief's optional stretch ideas or infrastructure the design made unnecessary; the things
the brief grades hardest — server authorization, state validation, audit history, bulk results,
documentation — were never on the cut list.

## After the budget

The twelve-hour mark closed with a verification session: a goal-by-goal audit of the finished app
against the brief, checking route handlers, RLS policies, and database triggers rather than just
the UI, plus learner-facing progress polish (a real progress bar, completed-lesson states, modal
close interactions). One experiment ran during this window — replacing instant self-enrollment
with a request/approve workflow — and was fully reverted when re-read against the brief. The
reversal and its reasoning are recorded in decisions.md, and the revert itself (feature, revert
commit, dropped migration) is visible in git history.

A final submission pass followed: a class roster on the course page (enrolled learners with
per-learner completion counts), removal of the demo fallback so every action has exactly one
server-backed path, a production configuration bug diagnosed and fixed (a missing service-role
environment variable that silently blanked learner dashboards), an RLS count artifact corrected
so learners see true enrollment counts instead of their own row, and a full browser end-to-end
pass against the live deployment — login redirect, both roles, search, roster, CSV, and lesson
completion.
