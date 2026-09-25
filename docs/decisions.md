# Decisions

Log the decisions that actually shaped this codebase — the ones where a real alternative existed and
you picked one. At least five entries. For each: what you chose, what you rejected, and why. At least
one entry must be a decision you later reversed — say what changed your mind. It can be any entry
below, not necessarily the last one; add a **Later reversed:** line to whichever one it is.

## Decision 1

- **Chose:** A single Next.js monolith with Supabase behind it.
- **Rejected:** A separate SPA frontend with a standalone API service.
- **Why:** With one language, one repo, and one deploy, auth handling, server validation, and the
  UI sit next to each other, and every feature costs one change instead of three. A split
  frontend/backend would have bought an architectural purity nobody grades while spending hours
  that the enforcement layer needed. If the product grew a second client, the API routes already
  speak JSON and could be lifted out without rewriting the rules.

## Decision 2

- **Chose:** Postgres enums, unique constraints, and triggers for lifecycle values and state
  machines.
- **Rejected:** Free-form strings whose validity is checked only in React forms.
- **Why:** A React check protects the form, not the data — any direct API call, script, or future
  client skips it entirely. With the rules in the database, `draft → archived` is not "handled
  incorrectly", it is impossible. The cost is small (two trigger functions and some enums) and it
  removes a whole class of "how did the data get like this?" bugs.

## Decision 3

- **Chose:** An append-only `course_activity_log` where comments are just rows with
  `event = 'commented'`.
- **Rejected:** A mutable comments table plus a "last updated" field on the course.
- **Why:** The brief requires history that cannot be rewritten — including by instructors. One
  append-only table answers "what happened", "who did it", and "what did people say" with the
  same mechanism, and its immutability is structural: the table simply has no UPDATE or DELETE
  policy for any role. A separate comments table would have needed its own protection and a
  second place to check.

## Decision 4

- **Chose:** Derive inactivity from `last_progress_at` compared to a 14-day cutoff, with
  dismissals storing a snapshot of that timestamp.
- **Rejected:** A scheduled worker (cron job) that scans learners and writes alert records.
- **Why:** The alert is a deterministic function of data already in the database, so a query is
  always correct and can never drift from reality. A worker would add a runtime, a failure mode,
  and eventual-consistency questions for zero added correctness. The snapshot makes the one hard
  part — alerts re-appearing after renewed inactivity — fall out naturally: the dismissal only
  suppresses an alert while the learner's `last_progress_at` still matches the snapshot.

## Decision 5

- **Chose:** Store both lesson completion rows (`lesson_completions`) and the current progress
  state on the enrollment row.
- **Rejected:** Calculating progress from lesson rows on every request (or keeping only a
  percentage on the enrollment).
- **Why:** Progress is read constantly — every list, the dashboard, the alerts scan — while
  completion detail is read rarely. Denormalizing the current state keeps the hot path cheap,
  and the lesson rows keep it auditable and prove per-lesson completion. **Later reversed:** the
  first prototype kept only a percentage on the enrollment; adding the lesson rows turned out to
  be necessary to prove completion, support ordered lessons, and power the roster's "x of y".

## Decision 6

- **Chose:** A request/approve workflow replacing instant learner self-enrollment, built on an
  `enrollment_requests` table with pending/approved/rejected states.
- **Rejected:** Keeping goal 5's direct self-enrollment unchanged.
- **Why:** While testing, self-enrollment felt too instant for a training catalogue where an
  instructor might want a gate.
- **Later reversed:** Re-reading the brief showed goal 5 specifies that learners "can enrol
  themselves" directly — the approval queue was scope creep that added a second pending state to
  explain, seed, and demo, in exchange for nothing any goal asked for. It was reverted completely
  rather than kept behind a flag: the feature commit, its revert, and the migration removal are
  all in git history (`f4c0c54`, `f8afe0f`, `4999ba3`), and the schema carries no
  `enrollment_requests` leftovers. Dead code behind a flag is still dead code someone has to
  understand.

## Decision 7

- **Chose:** Role-wide instructor permissions — any instructor can edit, publish, archive,
  bulk-enroll into, and export any course, and the catalogue shows instructors all courses.
- **Rejected:** Ownership scoping (only a course's author may edit it; an instructor's feed shows
  only courses they own).
- **Why:** The brief describes a small internal training team ("built by a couple of instructors")
  and none of the ten goals mentions ownership. The activity log already answers "who did this",
  and scoping would ripple through bulk enrollment, CSV export, the dashboard's company-wide
  headline numbers, and the shared demo dataset for no assessed gain. The rejection is also
  cheap to reverse if a multi-tenant need ever appears: add `instructor_id = auth.uid()` to the
  `instructors manage courses/lessons` RLS `with check` clauses and scope the routes the same way.

## Decision 8

- **Chose:** Fail visibly when the backend is unavailable — one code path per action, no
  client-side fixture.
- **Rejected:** A deterministic demo fixture that rendered a working course page with local-only
  mutations whenever Supabase was unreachable.
- **Why:** The fixture was insurance for a free-tier host outage, but it meant every mutation
  carried a second `isDemo` branch, shipped fake data in the client bundle, and could pass off a
  simulation as the real system. The live seeded database plus the credentials in `SUBMISSION.md`
  cover reviewability without it.
- **Later reversed:** the fixture shipped in the first build and was removed after the goal audit;
  removing it collapsed roughly ten demo branches in the course page into single server-backed
  paths and shrank the client bundle. (The login page's demo-account quick-fill later returned as
  pure form-filling convenience — it touches no data path.)

## Decision 9

- **Chose:** Merge true enrollment counts into the learner catalogue from the service role, after
  the route has already resolved the caller and forced `status = 'published'` for non-instructors.
- **Rejected:** Shipping the RLS-filtered count — a learner's `enrollments(count)` embed only sees
  their own enrollment row, so every course showed 0 or 1 learners — or dropping the learners
  column for learners altogether.
- **Why:** The total is legitimate, non-sensitive catalogue data; showing a distorted value or
  hiding it both misrepresent the system. The service read fetches one column (`course_id`) for
  exactly the courses on the page, mirroring the audited roster-read pattern, and the service key
  never reaches the browser. This decision came out of a production end-to-end pass, which is
  also why it is documented rather than silently patched.

## Decision 10

- **Chose:** Treat row-level security as the boundary that has to hold on its own, and move every
  multi-step write (lesson completion, lesson reorder, lesson removal) into a Postgres function
  that runs as one transaction.
- **Rejected:** What the first version did — route handlers as the first wall with RLS as a
  roughly-right backup, a learner UPDATE policy on `enrollments` so the completion route could
  write progress with the learner's own session, and workflows written as a chain of separate
  supabase-js calls.
- **Why:** The browser signs in with Supabase directly, so it holds a session and the anon key
  and can call the REST API without touching my routes. A post-submission review, signed in as
  the demo learner against the live project, showed what that meant: the learner, enrolled in 6
  courses, could read activity from 20, including other learners' completions and email
  addresses, because the activity-log policy compared an unqualified `course_id` that Postgres
  resolved to the enrollment table's own column. Reading the policies with that in mind turned up
  more: a learner could insert an already-completed enrollment (the progress trigger only fires on
  UPDATE), update their own progress, and an instructor could delete a course and cascade its
  history away. Separately, chained writes had no transaction — a failure between the completion
  insert and the progress update left them out of step, and two quick clicks on the last two
  lessons could leave a learner who had finished everything stuck In Progress. Functions fix
  both at once: learners now hold no write permission on progress at all, `complete_lesson`
  checks ownership itself and locks the enrollment row, and each workflow commits or rolls back
  as a unit. The cost is that some logic moved from TypeScript into PL/pgSQL, so I added
  `npm run test:db` — 43 checks run as each role against a throwaway Postgres.
- **Later reversed:** this entry reverses the original arrangement described under *Rejected*,
  which shipped in the submitted version.

## Decision 11

- **Chose:** A learner who has completed a course stays Completed if an instructor later adds a
  lesson; the roster shows them as, for example, 8 of 9.
- **Rejected:** Moving them back to In Progress when the course grows.
- **Why:** The brief's progress sequence only moves forward, and the transition trigger enforces
  that, so reopening would need a new transition the brief does not describe. It would also
  quietly change a compliance record: someone who finished the mandatory course last month did
  finish it. If reopening were wanted, it should be an explicit instructor action that is logged,
  not a side effect of editing content.
