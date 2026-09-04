# AI prompts

The prompts below are in the order I used them, lightly cleaned up for spelling and grouped by
what I was trying to do. Every one that produced something wrong, and what I changed afterwards,
is recorded — the correction that produced commits `f8afe0f` and `4999ba3` (a full revert) is the
biggest example.

## 1. Understanding the brief before writing any code

### Prompt

“Analyze the assignment folder and tell me in easy and detailed manner what kind of system it
asks for and mention all the features that must be present. Don't write code yet.”

### What you got

A plain-language breakdown: this is an internal training LMS, ten required goals, several with
exact server-side rules (state machines, per-address bulk results, immutable history, alert
re-arming). It also surfaced how the scoring works — the record of thinking in the docs and git
history matters more than the app itself, and code I can't explain is the most common way
candidates fail.

### What you corrected

My first instinct was to treat the dashboard as the main deliverable because it is the most
visible screen. The breakdown showed the differentiators are server-side enforcement and the
paper trail, so I re-planned to build authorization and constraints first and reporting last.

## 2. Schema, authorization, and the state machines

### Prompt

“Design the schema: accounts with two roles, courses with ordered lessons, many-to-many
enrollment with progress tracking, an activity log that can never be edited, and inactivity
alerts. I want illegal state changes rejected by the database itself, not only by the UI — if
someone calls the API directly or writes SQL, the rules must still hold.”

### What you got

The four enums and seven tables, the three unique constraints (lesson ordering, enrollment,
completion), the RLS policy set per role, and the two transition triggers
(`validate_course_status_transition`, `validate_progress_transition`).

### What you corrected

The first sketch had a separate comments table and stored progress as a percentage on the
enrollment. Both were wrong for the brief: comments belong inside the same immutable history
(they became `event = 'commented'` rows in the log), and a percentage cannot prove per-lesson
completion (it became the progress enum plus `lesson_completions` rows).

## 3. Core flows, and the "worked in the UI but did nothing" correction

### Prompt

“Build login and the two workspaces. Instructors: create/edit/publish/archive courses, manage
lessons with ordering, enroll learners. Learners: see only published courses, self-enroll, see
my courses with progress, complete lessons. All rules checked on the server.”

### What you got

The route handlers under `src/app/api` with the 401/403/409/422 discipline, RLS as the second
layer, and the first version of both workspaces.

### What you corrected

This is the correction I am most glad I caught: the first dashboard dialogs only updated local
state, so the UI appeared to work while nothing reached the database. A review pass asking
"what is only presentational?" exposed it. The dialogs now submit to the server routes, the CSV
export resolves the authenticated instructor context instead of trusting the caller, and the
course/progress transition triggers were added after asking what a direct API call could break.

## 4. Demo data

### Prompt

“Give me one command that resets a believable demo workspace: 20 accounts with a shared
password, 18 courses with eight lessons each, enrollments with completions, and some learners
quiet for 15–22 days so the inactivity alerts view shows something. Use deterministic fixed IDs
so every test run looks the same.”

### What you got

`npm run seed:demo` — two service-role scripts (auth accounts, then data) plus a reviewable
`seed.sql`, all keyed to the fixed UUIDs `10000000-…-0001…0018`.

### What you corrected

The data script wipes before it reseeds. I learned to treat it as a reset button after it
destroyed some hand-created test data I meant to keep — the warning now lives in the project
notes, not just in my head.

## 5. Enrollment and archived-history fixes (commit `0118fab`)

### Prompt

“Two enrollment bugs: an instructor who didn't create the course can't enroll a learner into it,
and a learner who is enrolled in an archived course loses it from their dashboard. Both should
work — the brief doesn't restrict instructor enrollment to course owners, and enrollment history
must survive archiving.”

### What you got

Role-checked enrollment that works for any instructor into any published course, and the
learner's enrollment list re-reading through the service role so archived courses stay visible
while RLS still hides them from the catalogue.

## 6. Workspace personalization (commit `7b316b0`)

### Prompt

“The workspace greets the wrong person — there is a hardcoded profile in there. Render the
signed-in user's real name and role from the session everywhere.”

### What you got

`page.tsx` resolving the auth context server-side and passing the real profile down; no
hardcoded identity left in the UI.

## 7. CSV export (commit `8cac2a0`)

### Prompt

“Instructors need to download every enrolled learner's progress in a course as a CSV file. Build
it server-side, gate it to instructors, quote the fields properly, and put the button on the
course page.”

### What you got

`GET /api/export/[courseId]` building the CSV on the server from all enrollments joined to
learner profiles, returned as an attachment.

## 8. The enrollment-request experiment — built, then reverted (commits `f4c0c54`, `f8afe0f`, `4999ba3`)

### Prompt

“Replace instant self-enrollment with a request/approve flow: learners send a request, the
course's instructor approves or rejects it, and there's a roster on the course page. Write the
migration first.”

### What you got

An `enrollment_requests` table with pending/approved/rejected states, request routes, and UI
wiring — a complete working feature.

### What you corrected

Re-reading the brief showed goal 5 says learners "can enrol themselves" directly. The approval
queue was scope creep: a second pending state to explain, seed, and demo, in exchange for
nothing any goal asked for. I asked for a full revert rather than keeping it behind a flag —
feature commit reverted, migration dropped, schema checked for leftovers. The three commits are
in the history on purpose; that is what the reversal actually looked like.

## 9. Progress polish (commit `ecc19c6`)

### Prompt

“On the course page give learners a real progress bar with 'x of y lessons complete', show
completed lessons with a check state, and make the modals close on Escape, backdrop click, and
the X button.”

### What you got

The progress track/fill bar, completed-lesson badges, and the keyboard/backdrop close handlers.

## 10. Spec-compliance audit (commits `92068b1`, `93c10af`)

### Prompt

“Now check if all this functionality is added — no extra, only the required ones — and what is
left. Verify against the assignment itself, not from memory.”

### What you got

A goal-by-goal verdict with file-level evidence: RLS policies, transition triggers, route checks.
It confirmed all ten goals were implemented with server-side enforcement, confirmed no stretch
ideas were built, flagged the demo fixture and a learners directory as extras, and listed scale
caveats (handler-side sorting/pagination, dashboard aggregation in Node).

### What you corrected

The audit found a stale handoff note still describing the reverted enrollment-request migration
as pending work — a trap for any future session. I had it removed and documented the reversal as
a decision instead of leaving unexplained revert commits in the history.

## 11. Roster, demo-fallback removal (commit `18cf43e`)

### Prompt

“Remove the demo fallback completely — every action should have one server-backed path, no fake
data anywhere. Also the course page should show a list of enrolled students and their completion
status.”

### What you got

`demo-data.ts` deleted, the env-missing branch and every `isDemo` branch removed, and the class
roster: enrolled learners with a progress badge and per-learner "x of y lessons", read through
the service role because RLS only lets learners read their own completions.

### What you corrected

I initially asked to drop the login-page demo quick-fill along with everything else, then added
it back as pure form-filling convenience for reviewers — it touches no data path, so it does not
reintroduce the two-code-path problem.

## 12. Production end-to-end pass, and the count bug (commits `d9396a9` → `46b34d6`)

### Prompt

“The service-role key was missing in Vercel — I've added it and redeployed. Now test the product
in the browser end to end: login redirect, instructor flows, learner flows. Elena's dashboard was
empty after enrolling — check that specifically.”

### What you got

A full browser pass over the live deployment: fresh sessions land on `/login`, instructor
dashboard metrics/chart/alerts work, search returns exact counts, the roster renders, CSV
downloads, a lesson completion walks the state machine. And it caught a real bug family: catalogue
learner counts showed 0 or 1 because RLS limits a learner's `enrollments(count)` embed to their
own enrollment row.

### What you corrected

The fix took three small commits (a service-role tally merge, the my-courses embed, the UI
mapping), and one intermediate commit failed its typecheck — I had assumed a PostgREST embed
would be an object where the client types it as an array. It was corrected in the immediately
following commit before it could reach a deployment, and the final state was re-verified in the
browser. Lesson recorded: never let a build status get masked by a pipe.

## 13. Submission polish (commits `f297078`, `1d86dd3`)

### Prompt

“Make SUBMISSION.md the best it can be because reviewers open that file first. Optimize the other
graded docs too — more detailed, natural tone, easy to digest without losing quality. Keep the
interview prep doc local only, never committed.”

### What you got

A reviewer-first SUBMISSION.md with a five-minute tour, a prompt log that maps onto the commit
history (this file), a deployment-and-configuration section in architecture.md including the
missing-env-var incident, decision 9 documenting the RLS count fix, and a schema doc that
explains why each 100× bottleneck actually breaks.

## 14. Interface polish, honest stats, and the deploy (commits `92d55b4` → `72e0c9b`)

### Prompt

“Some UI components are not clickable — the settings button, top-right profile button, top-left
workspace dropdown, and the see-what's-new banner make a bad impression. Improve them. Then make
sure design titles and stats are self-explanatory, the catalogue should look like actual courses,
minimal and fast. Any stat must not be hardcoded — dummy data can be fed but not hardcoded. Work
on a separate branch.”

### What you got

Real popover menus for the workspace switcher and profile avatar (with sign-out), a settings
modal showing the account and workspace exactly as the system sees them, and a changelog modal
listing genuinely shipped updates. The polish pass then replaced the hardcoded percentage in
learner progress bars with real per-course completion counts from lesson data, gave instructors a
per-course completion column in the catalogue, resolved instructor names for learners, and pinned
the greeting date locale to fix a hydration mismatch the dev overlay exposed.

### What you corrected

The first dropdown version rendered the trigger without attaching its click handler — caught
immediately because the popover would not open. The pass also surfaced two real artifacts: a
learner catalogue row showing "By Kinship" because RLS hides the instructor's profile (fixed by
extending the audited service-role merge), and an alert badge clamping quiet days to a minimum of
15. Everything was verified in the browser against the merged result before deploying.
