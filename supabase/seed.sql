-- Auth users must already exist in Supabase Auth. These IDs are the demo users
-- created in the classesin project; replace them if you create new users.
-- maya@northstar.co (instructor): ae6cd731-e837-4ff1-af19-b667cf6d3e80
-- elena@northstar.co (learner):   2b136953-ae6d-425f-bab6-09de63426cd6

insert into public.profiles (id, full_name, email, role) values
  ('ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'Maya Patel', 'maya@northstar.co', 'instructor'),
  ('2b136953-ae6d-425f-bab6-09de63426cd6', 'Elena Garcia', 'elena@northstar.co', 'learner')
on conflict (id) do update set full_name = excluded.full_name, email = excluded.email, role = excluded.role;

insert into public.courses (id, title, description, category, instructor_id, status, published_at) values
  ('10000000-0000-0000-0000-000000000001', 'Security foundations', 'Build practical habits for protecting customer data and company systems.', 'Compliance', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'published', now()),
  ('10000000-0000-0000-0000-000000000002', 'Leading with clarity', 'A practical workshop for making decisions, giving feedback, and building trust.', 'Leadership', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'published', now()),
  ('10000000-0000-0000-0000-000000000003', 'The manager toolkit', 'Rituals and tools for your first 90 days as a people manager.', 'Leadership', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'draft', null),
  ('10000000-0000-0000-0000-000000000004', 'Customer conversations', 'Turn difficult conversations into moments that build lasting relationships.', 'Skills', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'archived', null),
  ('10000000-0000-0000-0000-000000000005', 'Inclusive interviewing', 'Create structured, equitable hiring loops that reveal great talent.', 'People', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'published', now()),
  ('10000000-0000-0000-0000-000000000006', 'Remote collaboration', 'Design async-first ways of working that keep teams connected.', 'Skills', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'archived', null),
  ('10000000-0000-0000-0000-000000000007', 'Data literacy essentials', 'Use trustworthy data to make better everyday decisions.', 'Skills', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'published', now()),
  ('10000000-0000-0000-0000-000000000008', 'Coaching conversations', 'Build confidence through practical coaching habits.', 'Leadership', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'published', now()),
  ('10000000-0000-0000-0000-000000000009', 'Privacy by design', 'Make privacy a reliable part of product and process decisions.', 'Compliance', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'published', now()),
  ('10000000-0000-0000-0000-000000000010', 'Facilitation fundamentals', 'Plan inclusive meetings that end with clear decisions.', 'People', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'draft', null),
  ('10000000-0000-0000-0000-000000000011', 'Writing for impact', 'Turn complex ideas into clear, useful communication.', 'Skills', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'published', now()),
  ('10000000-0000-0000-0000-000000000012', 'Manager onboarding', 'A practical first month for new people leaders.', 'Leadership', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'published', now())
on conflict (id) do nothing;

insert into public.lessons (id, course_id, title, content, position) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Why security matters', 'The basics of our shared responsibility.', 1),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Handling customer data', 'Practical data handling scenarios.', 2),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Clarity as a habit', 'A simple decision-making framework.', 1),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Feedback that lands', 'How to make feedback actionable.', 2),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000004', 'Listen first', 'A customer-centered listening practice.', 1),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000005', 'Structured interviews', 'Use a consistent interview scorecard.', 1),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000007', 'Reading a dashboard', 'Ask better questions of operational data.', 1),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000008', 'The coaching loop', 'A repeatable structure for useful coaching.', 1),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000009', 'Privacy checkpoints', 'Spot privacy risks before they ship.', 1),
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000011', 'Write the headline', 'Lead with the decision your reader needs.', 1),
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000012', 'Your first 30 days', 'Set expectations and build trust early.', 1)
on conflict (id) do nothing;

insert into public.enrollments (id, course_id, learner_id, progress, enrolled_at, started_at, last_progress_at, completed_at) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2b136953-ae6d-425f-bab6-09de63426cd6', 'in_progress', now() - interval '19 days', now() - interval '22 days', now() - interval '19 days', null),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '2b136953-ae6d-425f-bab6-09de63426cd6', 'not_started', now() - interval '4 days', null, null, null),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', '2b136953-ae6d-425f-bab6-09de63426cd6', 'completed', now() - interval '35 days', now() - interval '34 days', now() - interval '2 days', now() - interval '2 days')
on conflict (id) do nothing;

insert into public.lesson_completions (enrollment_id, lesson_id) values
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005')
on conflict (enrollment_id, lesson_id) do nothing;

insert into public.course_activity_log (course_id, actor_id, event, message) values
  ('10000000-0000-0000-0000-000000000001', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'created', 'Course created'),
  ('10000000-0000-0000-0000-000000000001', 'ae6cd731-e837-4ff1-af19-b667cf6d3e80', 'published', 'Course published'),
  ('10000000-0000-0000-0000-000000000001', '2b136953-ae6d-425f-bab6-09de63426cd6', 'commented', 'The examples in this module were very helpful.')
on conflict do nothing;
