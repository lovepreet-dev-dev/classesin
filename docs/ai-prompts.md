# AI prompts

## Product decomposition and implementation plan

### Prompt

“Analyze the Course Delivery & Enrollment brief, identify the hard server-side rules, propose a schema, and sequence a 12-hour implementation.”

### What you got

A requirement-by-requirement plan covering roles, lifecycle transitions, progress, bulk enrollment, CSV export, dashboard metrics, immutable history, and inactivity dismissal semantics.

### What you corrected

The initial plan treated the dashboard as the main deliverable. It was corrected to prioritize authorization, database constraints, and invalid-transition tests because those are explicit assessment criteria.

## UI and interaction scaffold

### Prompt

“Design a calm, warm learning-workspace dashboard with course table, progress bars, alert badge, eight-week chart, role switcher, create-course modal, and bulk-enrollment modal.”

### What you got

A dashboard with responsive navigation, metric cards, search/filter controls, chart, activity list, modal forms, and seeded demo states.

### What you corrected

The first generated table was too dense on mobile. It was corrected with horizontal overflow at narrow widths, larger tap targets, and a compact icon-only sidebar.

## Data and server enforcement

### Prompt

“Create a Supabase Postgres schema and Next.js routes for server-side course filtering, learner self-enrollment, and CSV progress export.”

### What you got

The schema and routes in `supabase/schema.sql` and `src/app/api`.

### What you corrected

Client-only filtering was rejected. Search, category/status filters, pagination, and enrollment checks were moved into server queries and database policies.

The prompts you actually used, in the order you used them, grouped by what you were trying to achieve. For each significant one: what you asked, what you got back, and what you had to correct.

Include at least one prompt that produced something wrong, and what you did about it.

If you did not use AI at all, say so here, and describe your process instead.

## Additional correction record

### Prompt

“Review the finished take-home against every required goal and identify anything that is only presentational.”

### What you got

The review identified that the initial dashboard dialogs were local-only, exports needed an explicit instructor check, and the database needed trigger-level transition guards.

### What you corrected

The dialogs now submit to server routes, CSV export resolves authenticated instructor context, and `schema.sql` includes course/progress transition triggers. The deterministic fixture remains only as an unavailable-Supabase fallback.
