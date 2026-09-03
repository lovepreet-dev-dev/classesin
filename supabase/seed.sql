-- Kinship demo data. Create the matching Supabase Auth accounts first.
-- Password for every demo account: Demo123!
-- The password is intentionally generic for local/demo review only; it is never stored in profiles.

with demo_people(email, full_name, role) as (values
  ('maya@northstar.co', 'Maya Patel', 'instructor'), ('jon@northstar.co', 'Jon Bell', 'instructor'), ('priya@northstar.co', 'Priya Shah', 'instructor'), ('owen@northstar.co', 'Owen Brooks', 'instructor'),
  ('elena@northstar.co', 'Elena Garcia', 'learner'), ('aarav@northstar.co', 'Aarav Mehta', 'learner'), ('noah@northstar.co', 'Noah Williams', 'learner'), ('sofia@northstar.co', 'Sofia Chen', 'learner'),
  ('liam@northstar.co', 'Liam Okafor', 'learner'), ('mia@northstar.co', 'Mia Thompson', 'learner'), ('lucas@northstar.co', 'Lucas Martin', 'learner'), ('amara@northstar.co', 'Amara Okeke', 'learner'),
  ('theo@northstar.co', 'Theo Nguyen', 'learner'), ('grace@northstar.co', 'Grace Kim', 'learner'), ('mateo@northstar.co', 'Mateo Silva', 'learner'), ('priyanka@northstar.co', 'Priyanka Rao', 'learner'),
  ('ethan@northstar.co', 'Ethan Brooks', 'learner'), ('hana@northstar.co', 'Hana Park', 'learner'), ('caleb@northstar.co', 'Caleb Jones', 'learner'), ('isla@northstar.co', 'Isla Morgan', 'learner')
)
insert into public.profiles (id, full_name, email, role)
select u.id, p.full_name, lower(p.email), p.role::public.user_role
from demo_people p join auth.users u on lower(u.email) = lower(p.email)
on conflict (id) do update set full_name = excluded.full_name, email = excluded.email, role = excluded.role;

insert into public.courses (id, title, description, category, instructor_id, status, published_at) values
  ('10000000-0000-0000-0000-000000000001', 'Security foundations', 'Build practical habits for protecting customer data and company systems.', 'Compliance', (select id from public.profiles where email = 'maya@northstar.co'), 'published', now()),
  ('10000000-0000-0000-0000-000000000002', 'Leading with clarity', 'A practical workshop for making decisions, giving feedback, and building trust.', 'Leadership', (select id from public.profiles where email = 'jon@northstar.co'), 'published', now()),
  ('10000000-0000-0000-0000-000000000003', 'The manager toolkit', 'Rituals and tools for your first 90 days as a people manager.', 'Leadership', (select id from public.profiles where email = 'priya@northstar.co'), 'draft', null),
  ('10000000-0000-0000-0000-000000000004', 'Customer conversations', 'Turn difficult conversations into moments that build lasting relationships.', 'Skills', (select id from public.profiles where email = 'maya@northstar.co'), 'published', now()),
  ('10000000-0000-0000-0000-000000000005', 'Inclusive interviewing', 'Create structured, equitable hiring loops that reveal great talent.', 'People', (select id from public.profiles where email = 'jon@northstar.co'), 'published', now()),
  ('10000000-0000-0000-0000-000000000006', 'Remote collaboration', 'Design async-first ways of working that keep teams connected.', 'Skills', (select id from public.profiles where email = 'priya@northstar.co'), 'archived', null),
  ('10000000-0000-0000-0000-000000000007', 'Data literacy essentials', 'Use trustworthy data to make better everyday decisions.', 'Skills', (select id from public.profiles where email = 'owen@northstar.co'), 'published', now()),
  ('10000000-0000-0000-0000-000000000008', 'Coaching conversations', 'Build confidence through practical coaching habits.', 'Leadership', (select id from public.profiles where email = 'priya@northstar.co'), 'published', now()),
  ('10000000-0000-0000-0000-000000000009', 'Privacy by design', 'Make privacy a reliable part of product and process decisions.', 'Compliance', (select id from public.profiles where email = 'maya@northstar.co'), 'published', now()),
  ('10000000-0000-0000-0000-000000000010', 'Facilitation fundamentals', 'Plan inclusive meetings that end with clear decisions.', 'People', (select id from public.profiles where email = 'jon@northstar.co'), 'draft', null),
  ('10000000-0000-0000-0000-000000000011', 'Writing for impact', 'Turn complex ideas into clear, useful communication.', 'Skills', (select id from public.profiles where email = 'owen@northstar.co'), 'published', now()),
  ('10000000-0000-0000-0000-000000000012', 'Manager onboarding', 'A practical first month for new people leaders.', 'Leadership', (select id from public.profiles where email = 'jon@northstar.co'), 'published', now()),
  ('10000000-0000-0000-0000-000000000013', 'Product discovery', 'Explore customer problems and shape better product bets.', 'Product', (select id from public.profiles where email = 'owen@northstar.co'), 'published', now()),
  ('10000000-0000-0000-0000-000000000014', 'Operational excellence', 'Create repeatable systems that make good work easier.', 'Operations', (select id from public.profiles where email = 'priya@northstar.co'), 'published', now()),
  ('10000000-0000-0000-0000-000000000015', 'Giving great presentations', 'Structure and deliver clear presentations for any audience.', 'Communication', (select id from public.profiles where email = 'maya@northstar.co'), 'published', now()),
  ('10000000-0000-0000-0000-000000000016', 'Responsible AI at work', 'Use AI thoughtfully, securely, and transparently in daily work.', 'Compliance', (select id from public.profiles where email = 'owen@northstar.co'), 'published', now()),
  ('10000000-0000-0000-0000-000000000017', 'Hiring manager essentials', 'Build a fair, focused process for every new hire.', 'People', (select id from public.profiles where email = 'priya@northstar.co'), 'archived', null),
  ('10000000-0000-0000-0000-000000000018', 'Customer success playbook', 'Turn customer insight into consistent, proactive support.', 'Skills', (select id from public.profiles where email = 'owen@northstar.co'), 'published', now())
on conflict (id) do update set title = excluded.title, description = excluded.description, category = excluded.category, instructor_id = excluded.instructor_id, status = excluded.status, published_at = excluded.published_at;

-- Add a full eight-lesson path to every course. Existing lesson rows keep their IDs on re-runs.
with lesson_library(position, title, content) as (values
  (1, 'Start here', 'Set the context, goals, and expectations for this learning path.'),
  (2, 'Core concepts', 'Learn the essential ideas and vocabulary behind the topic.'),
  (3, 'A practical framework', 'Use a repeatable framework to turn knowledge into action.'),
  (4, 'Common scenarios', 'Work through realistic examples from everyday team situations.'),
  (5, 'Practice in context', 'Apply the ideas to a short scenario and compare approaches.'),
  (6, 'Tools and templates', 'Take away a lightweight tool you can use immediately.'),
  (7, 'Reflection', 'Pause to connect the learning to your current work and goals.'),
  (8, 'Make it stick', 'Choose one next step and make a plan to keep the habit going.')
)
insert into public.lessons (course_id, title, content, position)
select c.id, format('%s: %s', l.title, c.title), l.content, l.position
from public.courses c cross join lesson_library l
on conflict (course_id, position) do nothing;

with learners(no, email) as (values
  (1, 'elena@northstar.co'), (2, 'aarav@northstar.co'), (3, 'noah@northstar.co'), (4, 'sofia@northstar.co'),
  (5, 'liam@northstar.co'), (6, 'mia@northstar.co'), (7, 'lucas@northstar.co'), (8, 'amara@northstar.co'),
  (9, 'theo@northstar.co'), (10, 'grace@northstar.co'), (11, 'mateo@northstar.co'), (12, 'priyanka@northstar.co'),
  (13, 'ethan@northstar.co'), (14, 'hana@northstar.co'), (15, 'caleb@northstar.co'), (16, 'isla@northstar.co')
), assignments(course_no, learner_no, progress, quiet_days) as (values
  (1, 1, 'in_progress'::public.progress_status, 19), (1, 2, 'in_progress'::public.progress_status, 22), (1, 3, 'completed'::public.progress_status, 2), (1, 4, 'in_progress'::public.progress_status, 4), (1, 5, 'not_started'::public.progress_status, null),
  (2, 1, 'not_started'::public.progress_status, null), (2, 6, 'in_progress'::public.progress_status, 5), (2, 7, 'completed'::public.progress_status, 3), (2, 8, 'in_progress'::public.progress_status, 16),
  (4, 1, 'completed'::public.progress_status, 2), (4, 9, 'in_progress'::public.progress_status, 15), (4, 10, 'in_progress'::public.progress_status, 6), (4, 11, 'not_started'::public.progress_status, null),
  (5, 2, 'in_progress'::public.progress_status, 3), (5, 4, 'completed'::public.progress_status, 4), (5, 12, 'not_started'::public.progress_status, null),
  (7, 3, 'in_progress'::public.progress_status, 5), (7, 5, 'completed'::public.progress_status, 2), (7, 13, 'in_progress'::public.progress_status, 18),
  (8, 6, 'completed'::public.progress_status, 1), (8, 14, 'in_progress'::public.progress_status, 8), (8, 15, 'not_started'::public.progress_status, null),
  (9, 7, 'in_progress'::public.progress_status, 16), (9, 8, 'completed'::public.progress_status, 2), (9, 16, 'in_progress'::public.progress_status, 3),
  (11, 9, 'completed'::public.progress_status, 2), (11, 10, 'in_progress'::public.progress_status, 5), (11, 11, 'not_started'::public.progress_status, null),
  (12, 12, 'in_progress'::public.progress_status, 4), (12, 13, 'completed'::public.progress_status, 1), (12, 14, 'not_started'::public.progress_status, null),
  (13, 15, 'in_progress'::public.progress_status, 7), (13, 16, 'completed'::public.progress_status, 3), (14, 1, 'in_progress'::public.progress_status, 17), (14, 5, 'completed'::public.progress_status, 2),
  (15, 2, 'not_started'::public.progress_status, null), (15, 6, 'in_progress'::public.progress_status, 5), (16, 3, 'in_progress'::public.progress_status, 22), (16, 7, 'completed'::public.progress_status, 2),
  (18, 4, 'in_progress'::public.progress_status, 6), (18, 8, 'completed'::public.progress_status, 1), (18, 12, 'not_started'::public.progress_status, null)
)
insert into public.enrollments (id, course_id, learner_id, progress, enrolled_at, started_at, completed_at, last_progress_at)
select md5(a.course_no::text || ':' || a.learner_no::text)::uuid,
  ('10000000-0000-0000-0000-' || lpad(a.course_no::text, 12, '0'))::uuid,
  p.id, a.progress,
  now() - ((coalesce(a.quiet_days, 4) + 5)::text || ' days')::interval,
  case when a.progress = 'not_started' then null else now() - ((coalesce(a.quiet_days, 4) + 3)::text || ' days')::interval end,
  case when a.progress = 'completed' then now() - (coalesce(a.quiet_days, 2)::text || ' days')::interval else null end,
  case when a.progress = 'not_started' then null else now() - (coalesce(a.quiet_days, 2)::text || ' days')::interval end
from assignments a join learners l on l.no = a.learner_no join public.profiles p on lower(p.email) = l.email
on conflict do nothing;

insert into public.lesson_completions (enrollment_id, lesson_id, completed_at)
select e.id, l.id, coalesce(e.last_progress_at, now())
from public.enrollments e join public.lessons l on l.course_id = e.course_id
where e.progress = 'completed' or (e.progress = 'in_progress' and l.position <= 3)
on conflict (enrollment_id, lesson_id) do nothing;

insert into public.course_activity_log (course_id, actor_id, event, message)
select c.id, c.instructor_id, case when c.status = 'published' then 'published'::public.activity_event when c.status = 'archived' then 'archived'::public.activity_event else 'created'::public.activity_event end, case when c.status = 'published' then 'Course published' when c.status = 'archived' then 'Course archived' else 'Course created' end
from public.courses c
where not exists (select 1 from public.course_activity_log a where a.course_id = c.id and a.event = case when c.status = 'published' then 'published'::public.activity_event when c.status = 'archived' then 'archived'::public.activity_event else 'created'::public.activity_event end);

insert into public.course_activity_log (course_id, actor_id, event, message)
select '10000000-0000-0000-0000-000000000001'::uuid, id, 'commented', 'The examples in this module were very helpful.'
from public.profiles
where email = 'elena@northstar.co'
  and not exists (select 1 from public.course_activity_log where course_id = '10000000-0000-0000-0000-000000000001'::uuid and event = 'commented');
