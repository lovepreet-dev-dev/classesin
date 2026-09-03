# Schema

Tables:

- `profiles(id uuid FK auth.users, full_name text, email text unique, role user_role, created_at timestamptz)`.
- `courses(id uuid, title text, description text, category text, instructor_id uuid FK profiles, status course_status, created/updated/published/archived timestamps)`.
- `lessons(id uuid, course_id uuid FK courses, title text, content text, position integer, timestamps)`, with unique `(course_id, position)`.
- `enrollments(id uuid, course_id uuid FK courses, learner_id uuid FK profiles, progress progress_status, enrolled/started/completed/last_progress timestamps)`, with unique `(course_id, learner_id)`.
- `lesson_completions(id uuid, enrollment_id uuid FK enrollments, lesson_id uuid FK lessons, completed_at)`, with unique `(enrollment_id, lesson_id)`.
- `course_activity_log(id uuid, course_id uuid, actor_id uuid, event activity_event, message text, metadata jsonb, created_at)`. It is append-only.
- `alert_dismissals(id uuid, enrollment_id uuid, dismissed_by uuid, dismissed_at, dismissed_for_progress_at)`.
- `enrollment_requests(id uuid, course_id uuid FK courses, learner_id uuid FK profiles, status enrollment_request_status, created_at, decided_at, decided_by FK profiles)`, with a partial unique index so only one pending request exists per (course, learner).

Courses→lessons, courses→enrollments, and profiles→courses are one-to-many. Learners↔courses are many-to-many through enrollments; enrollments↔lessons are many-to-many through lesson_completions.

The database owns foreign keys, uniqueness, positive lesson positions, enum values, indexes, RLS visibility, append-only activity permissions, and trigger guards for legal course/progress transitions. Application/server code owns contextual rules (an empty course cannot publish and a completion must belong to the learner’s enrollment), because those checks require related-row counts. Current progress is deliberately denormalised on enrollments for fast dashboard and alert queries; lesson completions remain the source of detail. At 100× scale, aggregate enrollment counts, text search, and dashboard queries would need materialized views/full-text indexes and background aggregation.

The schema keeps identity in `profiles` while Auth remains the source of credentials. Courses own ordered lessons; enrollments join learners to courses; lesson completions join an enrollment to individual lessons; activity and dismissal rows preserve operational history. Database checks protect structural integrity and legal state changes, while route handlers perform contextual checks that span several related rows.
