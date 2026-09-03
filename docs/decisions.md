# Decisions

Log the decisions that actually shaped this codebase — the ones where a real alternative existed and
you picked one. At least five entries. For each: what you chose, what you rejected, and why. At least
one entry must be a decision you later reversed — say what changed your mind. It can be any entry
below, not necessarily the last one; add a **Later reversed:** line to whichever one it is.

## Decision 1

- **Chose:** A Next.js monolith with Supabase.
- **Rejected:** A separate SPA/API deployment.
- **Why:** It keeps auth, server validation, UI, and deployment inside a small surface area for a 12-hour exercise.

## Decision 2

- **Chose:** Postgres enums and constraints for lifecycle values and uniqueness.
- **Rejected:** Free-form strings checked only in React.
- **Why:** Illegal data should be rejected even when a caller bypasses the UI.

## Decision 3

- **Chose:** Append-only activity log rows.
- **Rejected:** An editable “last updated” field or mutable comments table.
- **Why:** The assignment explicitly requires history that cannot be rewritten.

## Decision 4

- **Chose:** Derive inactivity from `last_progress_at` plus a dismissal snapshot.
- **Rejected:** A scheduled email/worker system.
- **Why:** The alert is a queryable product state and does not need another runtime at this scale.

## Decision 5

- **Chose:** Store both lesson completion rows and current enrollment progress.
- **Rejected:** Calculating every dashboard metric from lesson rows on every request.
- **Why:** Detail remains auditable while common lists and alerts stay fast. Later reversed: the first prototype kept only a percentage on enrollment; adding lesson rows was necessary to prove completion and support ordered lessons.

## Decision 6

- **Chose:** A request/approve workflow replacing instant learner self-enrollment, built on an
  `enrollment_requests` table with pending/approved/rejected states.
- **Rejected:** Keeping goal 5's direct self-enrollment unchanged.
- **Why:** While testing, self-enrollment felt too instant for a training catalogue where an
  instructor might want a gate.
- **Later reversed:** Re-reading the brief showed goal 5 specifies that learners "can enrol
  themselves" directly — the approval queue was scope creep that added a second pending state to
  explain, seed, and demo for no goal. It was reverted completely rather than kept behind a flag:
  the feature commit, its revert, and the migration removal are all in git history (`f4c0c54`,
  `f8afe0f`, `4999ba3`), and the schema carries no `enrollment_requests` leftovers.

## Decision 7

- **Chose:** Role-wide instructor permissions — any instructor can edit, publish, archive,
  bulk-enroll into, and export any course, and the catalogue shows instructors all courses.
- **Rejected:** Ownership scoping (only a course's author may edit it; an instructor's feed shows
  only courses they own).
- **Why:** The brief describes a small internal training team ("built by a couple of instructors")
  and none of the ten goals mentions ownership. The activity log already answers "who did this",
  and scoping would ripple through bulk enrollment, CSV export, the dashboard's company-wide
  headline numbers, and the shared demo dataset for no assessed gain. If a multi-tenant need ever
  appeared, the change is contained: add `instructor_id = auth.uid()` to the
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
  paths and shrank the client bundle.
