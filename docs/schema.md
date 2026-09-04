# Schema

## The shape in one paragraph

Seven tables and four enums. Identity lives in `profiles`, one row per Supabase auth user.
Courses own an ordered list of lessons. `enrollments` is the many-to-many join between learners
and courses — and it also carries each learner's state in that course, which is why it exists as
a real table rather than an array on the course. `lesson_completions` joins enrollments to
individual lessons so "done" is provable per lesson. `course_activity_log` is the append-only
history (comments are rows in it), and `alert_dismissals` records inactivity-alert dismissals.
Every table has row-level security enabled, two triggers guard the state machines, and three
unique constraints make enrollment, lesson ordering, and completion idempotent.

## Enums

- `user_role`: `instructor | learner`
- `course_status`: `draft | published | archived`
- `progress_status`: `not_started | in_progress | completed`
- `activity_event`: `created | edited | published | archived | restored | commented | lesson_completed | enrolled | alert_dismissed`

Enums rather than free text because an invalid value should be unrepresentable: a typo in a
status string checked only in the UI would silently create a course no query can classify.

## Tables, each with its reason

**profiles** — `id uuid PK → auth.users ON DELETE CASCADE`, `full_name text NOT NULL`, `email
text NOT NULL UNIQUE`, `role user_role NOT NULL DEFAULT 'learner'`, `created_at timestamptz NOT
NULL DEFAULT now()`. The cascade means deleting an auth user cleans up the profile; the email is
unique because login is by email; the role defaults to `learner` so a provisioning mistake can
never accidentally hand out instructor powers.

**courses** — `id uuid PK`, `title text NOT NULL`, `description text NOT NULL DEFAULT ''`,
`category text NOT NULL`, `instructor_id uuid NOT NULL → profiles`, `status course_status NOT
NULL DEFAULT 'draft'`, `created_at / updated_at timestamptz NOT NULL DEFAULT now()`,
`published_at / archived_at timestamptz NULL`. New courses are drafts by default — a course that
forgets to set a status is invisible to learners, which is the safe failure. The two lifecycle
timestamps record when transitions actually happened, and the activity log corroborates them.

**lessons** — `id uuid PK`, `course_id uuid NOT NULL → courses ON DELETE CASCADE`, `title text
NOT NULL`, `content text NOT NULL DEFAULT ''`, `position integer NOT NULL CHECK (position > 0)`,
`created_at / updated_at timestamptz NOT NULL DEFAULT now()`, `UNIQUE (course_id, position)`.
That unique constraint does real work: the database physically cannot hold two lesson #3 in one
course, which is why reordering is implemented as a collision-free two-phase update — shift the
positions out of the way first, then set the final ones.

**enrollments** — `id uuid PK`, `course_id uuid NOT NULL → courses`, `learner_id uuid NOT NULL →
profiles`, `progress progress_status NOT NULL DEFAULT 'not_started'`, `enrolled_at timestamptz
NOT NULL DEFAULT now()`, `started_at / completed_at / last_progress_at timestamptz NULL`,
`UNIQUE (course_id, learner_id)`. This is the many-to-many join *and* the per-learner state
machine. The unique constraint makes enrollment idempotent: a duplicate is a constraint error the
routes translate into "Already enrolled", and the bulk importer translates into
`already_enrolled`. `last_progress_at` is the denormalized field the entire alerts feature reads.

**lesson_completions** — `id uuid PK`, `enrollment_id uuid NOT NULL → enrollments ON DELETE
CASCADE`, `lesson_id uuid NOT NULL → lessons ON DELETE CASCADE`, `completed_at timestamptz NOT
NULL DEFAULT now()`, `UNIQUE (enrollment_id, lesson_id)`. Completing a lesson twice is
impossible; the row count is the learner's "x of y lessons".

**course_activity_log** — `id uuid PK`, `course_id uuid NOT NULL → courses ON DELETE CASCADE`,
`actor_id uuid NULL → profiles`, `event activity_event NOT NULL`, `message text NULL`, `metadata
jsonb NOT NULL DEFAULT '{}'`, `created_at timestamptz NOT NULL DEFAULT now()`. One row per
event, with `actor_id` recording who. Comments are rows with `event = 'commented'` — there is no
separate comments table, because the brief requires comments to live in the same immutable
history. Immutability comes from RLS: the table has SELECT and INSERT policies and deliberately
no UPDATE or DELETE policy for any role, instructor included, and no endpoint mutates it.

**alert_dismissals** — `id uuid PK`, `enrollment_id uuid NOT NULL → enrollments ON DELETE
CASCADE`, `dismissed_by uuid NOT NULL → profiles`, `dismissed_at timestamptz NOT NULL DEFAULT
now()`, `dismissed_for_progress_at timestamptz NULL`. The interesting column is the last one: it
is a *snapshot* of `last_progress_at` taken at dismissal time. Suppression compares the snapshot
to the live value, which is what makes an alert re-appear after the learner engages again and
goes quiet for another 14 days — no scheduled job required.

## Relationships

- profiles → courses: one-to-many (an instructor owns courses).
- courses → lessons: one-to-many (a lesson belongs to exactly one course).
- courses → enrollments and profiles → enrollments: one-to-many each, so learners ↔ courses are
  many-to-many **through enrollments**.
- enrollments ↔ lessons: many-to-many **through lesson_completions**.
- enrollments → activity rows and dismissals: one-to-many.

## Indexes, and the queries they serve

- `courses(status, category)` — the catalogue's default filter pair.
- `courses(created_at desc)` — the "Newest" sort.
- `enrollments(progress, last_progress_at)` — the alerts query: `progress = 'in_progress' AND
  last_progress_at < cutoff` becomes a single index range scan.
- `course_activity_log(course_id, created_at desc)` — the course page's latest-20 activity read.

## Where each rule lives

**In the database:** foreign keys and cascade rules; the three uniqueness constraints; the
position check; enum values; the four indexes; the transition triggers
`validate_course_status_transition` (only draft→published, published→archived,
archived→published) and `validate_progress_transition` (only not_started→in_progress,
in_progress→completed), which fire even for a caller bypassing the app; and RLS on all seven
tables — "published courses or instructors", "instructors manage courses/lessons", "own or
instructor enrollments", "own progress writes", "own completions", activity select plus
append-only insert, instructor-only dismissals.

**In the application:** rules that need related rows or request context — an empty course cannot
publish (that needs a lesson count, so it is a 422 with a message from the route); a completion
must belong to the caller's enrollment; bulk-enroll classification per address (unknown /
already enrolled / newly enrolled); the dashboard's month-scoped counts and 8-week buckets; the
alert-dismissal snapshot semantics.

## Deliberate denormalisation

Current progress state and its timestamps live on `enrollments` even though `lesson_completions`
is the detail source. Progress is read by every list, dashboard query, and alert scan; deriving
it from lesson rows on each request would put an aggregate in the hottest read path. The alert
query reads `last_progress_at` straight off the same row, which is also why dismissal snapshots
work.

## What breaks first at 100× the data, and why

At 100× — roughly 1,800 courses and tens of thousands of enrollments — Postgres itself is
comfortable. The pressure lands on three patterns in the application layer:

1. **Catalogue sorting and paging.** The list query has no `LIMIT`: Postgres serializes every
   matching row — including its embedded joins — ships it over the network to the Node process,
   which sorts, slices ten, and discards the rest. Per page view. So latency and memory scale
   with the size of the catalogue, not the size of the page. The enrollment-count sort makes it
   worse: the count is computed per row as an embedded subquery, so ordering by it cannot use any
   index and re-sorts the full set on every request. The fixes are mechanical: `order()` and
   `range()` in SQL so Postgres ships ten rows, `count(head: true)` for the exact total, and a
   full-text (or pg_trgm) index for search — `ilike '%term%'` with a leading wildcard cannot use
   a B-tree index and degrades to a sequential scan of the whole table.
2. **Dashboard aggregation.** The route reads every enrollment row into Node and tallies in
   JavaScript. At 100× that is a full-table transfer per dashboard view to compute numbers that
   are a textbook `group by course_id, progress` — which would return a few dozen rows instead of
   thousands. If even that is too hot, a materialized view refreshed on writes moves the cost off
   the read path entirely.
3. **Enrollment-count sorting.** Same subquery-per-row problem as the first point, from the write
   side: it wants a maintained counter column updated in the same transaction as enrollment
   inserts, or a view — trading a little write complexity and a drift-reconciliation concern for
   an indexed read.

What does *not* break is worth stating too: the alerts query is already a single index range scan
against `enrollments(progress, last_progress_at)`; activity-log inserts stay O(1) and the course
read is indexed; and the transition triggers cost the same per write no matter how big the tables
get. The write path survives 100× untouched — only the read patterns need to become SQL-native,
which is a query-shape problem, not a sharding problem.
