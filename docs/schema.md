# Schema

## Enums

- `user_role`: `instructor | learner`
- `course_status`: `draft | published | archived`
- `progress_status`: `not_started | in_progress | completed`
- `activity_event`: `created | edited | published | archived | restored | commented | lesson_completed | enrolled | alert_dismissed`

## Tables

**profiles** — one row per auth user.
`id uuid PK → auth.users ON DELETE CASCADE`, `full_name text NOT NULL`, `email text NOT NULL UNIQUE`, `role user_role NOT NULL DEFAULT 'learner'`, `created_at timestamptz NOT NULL DEFAULT now()`

**courses**
`id uuid PK`, `title text NOT NULL`, `description text NOT NULL DEFAULT ''`, `category text NOT NULL`, `instructor_id uuid NOT NULL → profiles`, `status course_status NOT NULL DEFAULT 'draft'`, `created_at / updated_at timestamptz NOT NULL DEFAULT now()`, `published_at / archived_at timestamptz NULL`

**lessons**
`id uuid PK`, `course_id uuid NOT NULL → courses ON DELETE CASCADE`, `title text NOT NULL`, `content text NOT NULL DEFAULT ''`, `position integer NOT NULL CHECK (position > 0)`, `created_at / updated_at timestamptz NOT NULL DEFAULT now()`, `UNIQUE (course_id, position)`

**enrollments** — the many-to-many join between learners and courses, plus per-enrollment state.
`id uuid PK`, `course_id uuid NOT NULL → courses`, `learner_id uuid NOT NULL → profiles`, `progress progress_status NOT NULL DEFAULT 'not_started'`, `enrolled_at timestamptz NOT NULL DEFAULT now()`, `started_at / completed_at / last_progress_at timestamptz NULL`, `UNIQUE (course_id, learner_id)`

**lesson_completions** — which lessons of an enrollment are done.
`id uuid PK`, `enrollment_id uuid NOT NULL → enrollments ON DELETE CASCADE`, `lesson_id uuid NOT NULL → lessons ON DELETE CASCADE`, `completed_at timestamptz NOT NULL DEFAULT now()`, `UNIQUE (enrollment_id, lesson_id)`

**course_activity_log** — append-only history; a comment is a row with `event = 'commented'`.
`id uuid PK`, `course_id uuid NOT NULL → courses ON DELETE CASCADE`, `actor_id uuid NULL → profiles`, `event activity_event NOT NULL`, `message text NULL`, `metadata jsonb NOT NULL DEFAULT '{}'`, `created_at timestamptz NOT NULL DEFAULT now()`

**alert_dismissals**
`id uuid PK`, `enrollment_id uuid NOT NULL → enrollments ON DELETE CASCADE`, `dismissed_by uuid NOT NULL → profiles`, `dismissed_at timestamptz NOT NULL DEFAULT now()`, `dismissed_for_progress_at timestamptz NULL`

## Relationships

- profiles → courses: one-to-many (an instructor owns courses).
- courses → lessons: one-to-many (a lesson belongs to exactly one course).
- courses → enrollments and profiles → enrollments: one-to-many each, so learners ↔ courses are
  many-to-many **through enrollments**.
- enrollments ↔ lessons: many-to-many **through lesson_completions**.
- enrollments → activity rows and dismissals: one-to-many.

## Where each rule lives

**In the database:** foreign keys and cascade rules; the two uniqueness constraints that make both
enrollment and lesson completion idempotent; `position > 0`; enum values; four indexes
(`courses(status, category)`, `courses(created_at desc)`, `enrollments(progress, last_progress_at)`,
`course_activity_log(course_id, created_at desc)`); transition triggers
`validate_course_status_transition` (only draft→published, published→archived, archived→published)
and `validate_progress_transition` (only not_started→in_progress, in_progress→completed), which
fire even for a caller bypassing the app; RLS on all seven tables with role policies
("published courses or instructors", "instructors manage courses/lessons", "own or instructor
enrollments", "own progress writes", "own completions", activity select + append-only, instructor
dismissals). `course_activity_log` has **no update or delete policy for any role** — that absence
is what makes history immutable, including for instructors.

**In the application (needs related rows or request context):** an empty course cannot publish
(needs a lesson count → 422 with a message); a completion must belong to the caller's enrollment;
bulk-enroll classification per address (unknown / already enrolled / newly enrolled); the
dashboard's month-scoped counts and 8-week buckets; the alert-dismissal snapshot semantics.

## Deliberate denormalisation

Current progress state and its timestamps live **on enrollments** even though lesson rows are the
detail source. Progress is read by every list, dashboard query and alert scan; deriving it from
`lesson_completions` on each request would put an aggregate in the hottest read path. The alerts
query reads `last_progress_at` straight off the same row.

## What would break first at 100× the data

The catalogue's handler-side sort/page over all matching rows (move to SQL `order()/range()` +
`count(head: true)`, and a Postgres full-text index over title/description); dashboard aggregation
over all enrollment rows (materialized view or SQL `group by`); enrollment-count sorting would
want a maintained counter or a view. The `enrollments(progress, last_progress_at)` index is
already the right shape for the alerts query.
