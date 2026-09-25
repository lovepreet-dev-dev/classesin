-- The brief's goals, checked at the database layer. Runs in one transaction and rolls back.
\set ON_ERROR_STOP on
begin;

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.ok(passed boolean, name text) returns void language plpgsql as $$
begin
  if passed is not true then raise exception 'FAIL - %', name; end if;
  raise notice 'ok - %', name;
end;
$$;

create function pg_temp.fails(statement text, expected_state text, name text) returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'FAIL - % (statement succeeded)', name;
exception when others then
  if sqlerrm like 'FAIL - %' then raise; end if;
  if expected_state is not null and sqlstate <> expected_state then
    raise exception 'FAIL - % (expected %, got % %)', name, expected_state, sqlstate, sqlerrm;
  end if;
  raise notice 'ok - %', name;
end;
$$;

create function pg_temp.affected(statement text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end;
$$;

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-00000000000a', 'inst@rules.co'),
  ('10000000-0000-0000-0000-00000000000b', 'a@rules.co'),
  ('10000000-0000-0000-0000-00000000000c', 'b@rules.co');
insert into public.profiles (id, full_name, email, role) values
  ('10000000-0000-0000-0000-00000000000a', 'Inst', 'inst@rules.co', 'instructor'),
  ('10000000-0000-0000-0000-00000000000b', 'Learner A', 'a@rules.co', 'learner'),
  ('10000000-0000-0000-0000-00000000000c', 'Learner B', 'b@rules.co', 'learner');
insert into public.courses (id, title, category, instructor_id, status) values
  ('10000000-0000-0000-0000-0000000000c1', 'Published', 'T', '10000000-0000-0000-0000-00000000000a', 'published'),
  ('10000000-0000-0000-0000-0000000000c2', 'Second published', 'T', '10000000-0000-0000-0000-00000000000a', 'published');
insert into public.lessons (id, course_id, title, position) values
  ('10000000-0000-0000-0000-0000000001a1', '10000000-0000-0000-0000-0000000000c1', 'One', 1),
  ('10000000-0000-0000-0000-0000000001a2', '10000000-0000-0000-0000-0000000000c1', 'Two', 2),
  ('10000000-0000-0000-0000-0000000002a1', '10000000-0000-0000-0000-0000000000c2', 'Only', 1);
insert into public.enrollments (id, course_id, learner_id, progress, started_at, last_progress_at) values
  ('10000000-0000-0000-0000-0000000000e9', '10000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-00000000000c', 'in_progress', now() - interval '20 days', now() - interval '20 days');

-- Goal 1: roles
select pg_temp.login('10000000-0000-0000-0000-00000000000a');
select pg_temp.ok(pg_temp.affected($$insert into public.courses (id, title, category, instructor_id) values ('10000000-0000-0000-0000-0000000000d1', 'New draft', 'T', '10000000-0000-0000-0000-00000000000a')$$) = 1,
  'goal 1/2: instructor can create a course');
reset role;
select pg_temp.login('10000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$insert into public.courses (title, category, instructor_id) values ('x', 'T', '10000000-0000-0000-0000-00000000000b')$$, '42501', 'goal 1: learner cannot create a course');
select pg_temp.ok(pg_temp.affected($$update public.courses set title = 'hacked' where id = '10000000-0000-0000-0000-0000000000c1'$$) = 0, 'goal 1: learner cannot edit a course');
select pg_temp.fails($$insert into public.lessons (course_id, title, position) values ('10000000-0000-0000-0000-0000000000c1', 'x', 9)$$, '42501', 'goal 1: learner cannot add a lesson');
select pg_temp.ok(pg_temp.affected($$update public.lessons set content = 'hacked'$$) = 0, 'goal 1: learner cannot edit lesson content');
select pg_temp.ok((select count(*) from public.enrollments where learner_id = '10000000-0000-0000-0000-00000000000c') = 0, 'goal 1: learner cannot see another learner''s enrollment');
reset role;

-- Goal 2: edit, archive and restore keep lessons and enrollment history
select pg_temp.login('10000000-0000-0000-0000-00000000000a');
select pg_temp.ok(pg_temp.affected($$update public.courses set title = 'Renamed', description = 'd', category = 'U' where id = '10000000-0000-0000-0000-0000000000c2'$$) = 1, 'goal 2: instructor can edit a course');
select pg_temp.ok(pg_temp.affected($$update public.courses set status = 'archived' where id = '10000000-0000-0000-0000-0000000000c2'$$) = 1, 'goal 2: instructor can archive a published course');
reset role;
select pg_temp.login('10000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.courses where id = '10000000-0000-0000-0000-0000000000c2') = 0, 'goal 2: an archived course leaves the learner catalogue');
reset role;
select pg_temp.ok((select count(*) from public.lessons where course_id = '10000000-0000-0000-0000-0000000000c2') = 1
  and (select count(*) from public.enrollments where course_id = '10000000-0000-0000-0000-0000000000c2') = 1,
  'goal 2: archiving keeps lessons and enrollment history');
select pg_temp.login('10000000-0000-0000-0000-00000000000a');
select pg_temp.ok(pg_temp.affected($$update public.courses set status = 'published' where id = '10000000-0000-0000-0000-0000000000c2'$$) = 1, 'goal 2: instructor can restore an archived course');
select pg_temp.ok(pg_temp.affected($$update public.courses set status = 'archived' where id = '10000000-0000-0000-0000-0000000000c2'$$) = 1, 'goal 2: archive again');
select pg_temp.ok(pg_temp.affected($$delete from public.lessons where course_id = '10000000-0000-0000-0000-0000000000c2'$$) = 1, 'goal 3: lessons of an archived course can be removed');
select pg_temp.ok(pg_temp.affected($$update public.courses set status = 'published' where id = '10000000-0000-0000-0000-0000000000c2'$$) = 1, 'goal 2: restore is not blocked by the publish-time lesson check');

-- Goal 3: lessons
select pg_temp.ok(pg_temp.affected($$insert into public.lessons (id, course_id, title, content, position) values ('10000000-0000-0000-0000-0000000001a3', '10000000-0000-0000-0000-0000000000c1', 'Three', 'body', 3)$$) = 1, 'goal 3: instructor can add a lesson');
select pg_temp.ok(pg_temp.affected($$update public.lessons set title = 'Three!', content = 'new' where id = '10000000-0000-0000-0000-0000000001a3'$$) = 1, 'goal 3: instructor can edit a lesson');
select public.reorder_lessons('10000000-0000-0000-0000-0000000000c1', array['10000000-0000-0000-0000-0000000001a3', '10000000-0000-0000-0000-0000000001a1', '10000000-0000-0000-0000-0000000001a2']::uuid[]);
select pg_temp.ok((select string_agg(title, ',' order by position) from public.lessons where course_id = '10000000-0000-0000-0000-0000000000c1') = 'Three!,One,Two', 'goal 3: instructor can reorder lessons');
select public.delete_lesson('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000001a3');
select public.delete_lesson('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000001a2');
select pg_temp.ok((select array_agg(position) from public.lessons where course_id = '10000000-0000-0000-0000-0000000000c1') = array[1], 'goal 3: instructor can remove lessons from a published course');
select public.delete_lesson('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000001a1');
select pg_temp.ok((select count(*) from public.lessons where course_id = '10000000-0000-0000-0000-0000000000c1') = 0, 'goal 3: removing the last lesson of a published course is allowed');
select pg_temp.ok(pg_temp.affected($$insert into public.lessons (id, course_id, title, position) values ('10000000-0000-0000-0000-0000000001a1', '10000000-0000-0000-0000-0000000000c1', 'One', 1), ('10000000-0000-0000-0000-0000000001a2', '10000000-0000-0000-0000-0000000000c1', 'Two', 2)$$) = 2, 'goal 3: lessons can be added back');

-- Goal 4: course states
select pg_temp.fails($$update public.courses set status = 'published' where id = '10000000-0000-0000-0000-0000000000d1'$$, 'KN422', 'goal 4: publishing an empty draft is rejected');
select pg_temp.fails($$update public.courses set status = 'archived' where id = '10000000-0000-0000-0000-0000000000d1'$$, '22000', 'goal 4: draft -> archived is rejected');
select pg_temp.ok(pg_temp.affected($$insert into public.lessons (course_id, title, position) values ('10000000-0000-0000-0000-0000000000d1', 'L', 1)$$) = 1, 'goal 4: add a lesson to the draft');
select pg_temp.ok(pg_temp.affected($$update public.courses set status = 'published' where id = '10000000-0000-0000-0000-0000000000d1'$$) = 1, 'goal 4: a draft with a lesson publishes');
select pg_temp.fails($$update public.courses set status = 'draft' where id = '10000000-0000-0000-0000-0000000000d1'$$, '22000', 'goal 4: published -> draft is rejected');

-- Goal 5: enrollment, both ways, many-to-many
select pg_temp.ok(pg_temp.affected($$insert into public.enrollments (course_id, learner_id) values ('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000c')$$) = 1, 'goal 5: instructor can enroll a learner');
select pg_temp.fails($$insert into public.enrollments (course_id, learner_id) values ('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000c')$$, '23505', 'goal 5/7: a duplicate enrollment is a unique violation (already enrolled)');
reset role;
select pg_temp.login('10000000-0000-0000-0000-00000000000b');
select pg_temp.ok(pg_temp.affected($$insert into public.enrollments (course_id, learner_id) values ('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000b')$$) = 1, 'goal 5: learner can enroll themselves');
select pg_temp.ok(pg_temp.affected($$insert into public.enrollments (course_id, learner_id) values ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000b')$$) = 1, 'goal 5: a learner can hold several enrollments');
select pg_temp.ok(pg_temp.affected($$insert into public.course_activity_log (course_id, actor_id, event, message, metadata) values ('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000b', 'enrolled', 'Learner enrolled', '{"learner_id": "10000000-0000-0000-0000-00000000000b"}')$$) = 1,
  'goal 9: the self-enrollment route can log its enrolled event');
select pg_temp.ok((select count(*) from public.enrollments) = 2, 'goal 5: learner sees exactly their own enrollments');

-- Goal 4 and 10: progress moves only by working through lessons, and feeds the alert clock
select pg_temp.ok((public.complete_lesson('10000000-0000-0000-0000-0000000001a1')).progress = 'in_progress', 'goal 4: not started -> in progress');
select pg_temp.ok((select last_progress_at is not null and started_at is not null from public.enrollments where course_id = '10000000-0000-0000-0000-0000000000c1'), 'goal 10: completion stamps last_progress_at');
select pg_temp.ok((select count(*) from public.lesson_completions) = 1, 'goal 1: learner can read their own lesson completions');
select pg_temp.ok((public.complete_lesson('10000000-0000-0000-0000-0000000001a2')).progress = 'completed', 'goal 4: in progress -> completed');
select pg_temp.ok(pg_temp.affected($$insert into public.course_activity_log (course_id, actor_id, event, message) values ('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000b', 'commented', 'Great course')$$) = 1, 'goal 9: learner can leave a comment');
select pg_temp.fails($$insert into public.alert_dismissals (enrollment_id, dismissed_by) values ('10000000-0000-0000-0000-0000000000e9', '10000000-0000-0000-0000-00000000000b')$$, '42501', 'goal 10: learner cannot dismiss alerts');
reset role;

-- Goals 8, 9, 10 as the instructor
select pg_temp.login('10000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.enrollments where course_id = '10000000-0000-0000-0000-0000000000c1') = 2, 'goal 8: instructor sees every enrollment for the dashboard');
select pg_temp.ok((select count(*) from public.lesson_completions) = 2, 'goal 7: instructor can read every learner''s lesson completions');
select pg_temp.ok((select progress from public.enrollments where id = '10000000-0000-0000-0000-0000000000e9') = 'in_progress'
  and (select last_progress_at < now() - interval '14 days' from public.enrollments where id = '10000000-0000-0000-0000-0000000000e9'),
  'goal 10: a learner quiet for 20 days is visible to the alerts query');
select pg_temp.ok(pg_temp.affected($$insert into public.alert_dismissals (enrollment_id, dismissed_by, dismissed_for_progress_at) select id, '10000000-0000-0000-0000-00000000000a', last_progress_at from public.enrollments where id = '10000000-0000-0000-0000-0000000000e9'$$) = 1,
  'goal 10: instructor can dismiss an alert with a progress snapshot');
select pg_temp.ok(pg_temp.affected($$insert into public.course_activity_log (course_id, actor_id, event, message) values ('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000a', 'commented', 'Reply')$$) = 1, 'goal 9: instructor can leave a comment');
select pg_temp.ok((select count(*) from public.course_activity_log where course_id = '10000000-0000-0000-0000-0000000000c1' and event = 'edited') = 4, 'goal 9: the reorder and three removals are logged as edits');
select pg_temp.ok((select count(*) from public.course_activity_log where course_id = '10000000-0000-0000-0000-0000000000c1' and event = 'lesson_completed') = 2, 'goal 9: completions are logged');
select pg_temp.fails($$update public.course_activity_log set message = 'x'$$, '42501', 'goal 9: the instructor cannot edit history');
reset role;

-- Demo seed reset (npm run seed:demo clears tables in this order with the service role)
set local role service_role;
select pg_temp.ok(pg_temp.affected($$insert into public.enrollments (course_id, learner_id, progress, started_at, completed_at, last_progress_at) values ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000c', 'completed', now(), now(), now())$$) = 1,
  'seed: the service role can insert completed history');
delete from public.lesson_completions;
delete from public.alert_dismissals;
delete from public.enrollments;
delete from public.course_activity_log;
delete from public.lessons;
delete from public.courses;
select pg_temp.ok((select count(*) from public.courses) = 0 and (select count(*) from public.course_activity_log) = 0, 'seed: the reset sequence clears every table');
reset role;

rollback;
