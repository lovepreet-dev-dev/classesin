-- RLS, trigger and function checks. Runs in one transaction and rolls back.
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
  ('00000000-0000-0000-0000-00000000000a', 'inst@test.co'),
  ('00000000-0000-0000-0000-00000000000b', 'a@test.co'),
  ('00000000-0000-0000-0000-00000000000c', 'b@test.co');
insert into public.profiles (id, full_name, email, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Inst', 'inst@test.co', 'instructor'),
  ('00000000-0000-0000-0000-00000000000b', 'Learner A', 'a@test.co', 'learner'),
  ('00000000-0000-0000-0000-00000000000c', 'Learner B', 'b@test.co', 'learner');

insert into public.courses (id, title, category, instructor_id, status) values
  ('00000000-0000-0000-0000-0000000000c1', 'Published three', 'T', '00000000-0000-0000-0000-00000000000a', 'published'),
  ('00000000-0000-0000-0000-0000000000c2', 'Published one', 'T', '00000000-0000-0000-0000-00000000000a', 'published'),
  ('00000000-0000-0000-0000-0000000000c3', 'Draft one', 'T', '00000000-0000-0000-0000-00000000000a', 'draft'),
  ('00000000-0000-0000-0000-0000000000c4', 'Draft empty', 'T', '00000000-0000-0000-0000-00000000000a', 'draft');
insert into public.lessons (id, course_id, title, position) values
  ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000000c1', 'One', 1),
  ('00000000-0000-0000-0000-0000000001a2', '00000000-0000-0000-0000-0000000000c1', 'Two', 2),
  ('00000000-0000-0000-0000-0000000001a3', '00000000-0000-0000-0000-0000000000c1', 'Three', 3),
  ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000000c2', 'Only', 1),
  ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000000c3', 'Only', 1);
insert into public.enrollments (id, course_id, learner_id, progress, started_at, last_progress_at) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b', 'not_started', null, null),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000c', 'in_progress', now(), now());
insert into public.course_activity_log (course_id, actor_id, event, message, metadata) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'created', 'Course created', '{}'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000c', 'lesson_completed', 'Lesson completed', '{}'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'enrolled', 'Learner enrolled: b@test.co', '{"learner_id": "00000000-0000-0000-0000-00000000000c"}'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000c', 'commented', 'Hello', '{}'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'alert_dismissed', 'Inactivity alert dismissed', '{}'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000a', 'created', 'Course created', '{}'),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-00000000000a', 'created', 'Course created', '{}');

-- Learner A
select pg_temp.login('00000000-0000-0000-0000-00000000000b');

select pg_temp.ok((select count(*) from public.course_activity_log where course_id = '00000000-0000-0000-0000-0000000000c1') = 2,
  'learner sees only course events and comments on an enrolled course');
select pg_temp.ok((select count(*) from public.course_activity_log where course_id = '00000000-0000-0000-0000-0000000000c2') = 0,
  'learner sees no activity for a course they are not enrolled in');
select pg_temp.ok((select count(*) from public.course_activity_log where course_id = '00000000-0000-0000-0000-0000000000c4') = 0,
  'learner sees no activity for a draft course');
select pg_temp.ok((select count(*) from public.course_activity_log where message like '%@%') = 0,
  'learner cannot read other learners'' email addresses from the log');

select pg_temp.ok(pg_temp.affected($$insert into public.course_activity_log (course_id, actor_id, event, message) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b', 'commented', 'Hi')$$) = 1,
  'learner can comment on an enrolled course');
select pg_temp.fails($$insert into public.course_activity_log (course_id, actor_id, event, message) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b', 'published', 'fake')$$, '42501',
  'learner cannot append a non-comment event');
select pg_temp.fails($$insert into public.course_activity_log (course_id, actor_id, event, message) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000b', 'commented', 'Hi')$$, '42501',
  'learner cannot append to a course they are not enrolled in');
select pg_temp.fails($$update public.course_activity_log set message = 'edited'$$, '42501', 'learner cannot update the log');
select pg_temp.fails($$delete from public.course_activity_log$$, '42501', 'learner cannot delete from the log');

select pg_temp.fails($$insert into public.enrollments (course_id, learner_id) values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-00000000000b')$$, '42501',
  'learner cannot enroll in a draft course');
select pg_temp.fails($$insert into public.enrollments (course_id, learner_id, progress, completed_at) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000b', 'completed', now())$$, '42501',
  'learner cannot insert an already-completed enrollment');
select pg_temp.fails($$insert into public.enrollments (course_id, learner_id) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000c')$$, '42501',
  'learner cannot enroll another learner');
select pg_temp.ok(pg_temp.affected($$update public.enrollments set progress = 'in_progress', last_progress_at = now() + interval '1 year' where learner_id = '00000000-0000-0000-0000-00000000000b'$$) = 0,
  'learner cannot update their own enrollment row');
select pg_temp.fails($$insert into public.lesson_completions (enrollment_id, lesson_id) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000002a1')$$, '42501',
  'learner cannot insert lesson completions directly');

select pg_temp.ok((public.complete_lesson('00000000-0000-0000-0000-0000000001a1')).progress = 'in_progress', 'first completion moves to in_progress');
select pg_temp.fails($$select public.complete_lesson('00000000-0000-0000-0000-0000000001a1')$$, 'KN409', 'completing the same lesson twice is rejected');
select pg_temp.ok((public.complete_lesson('00000000-0000-0000-0000-0000000001a2')).progress = 'in_progress', 'second of three stays in_progress');
select pg_temp.ok((public.complete_lesson('00000000-0000-0000-0000-0000000001a3')).completed_at is not null, 'last lesson completes the course');
select pg_temp.ok((select progress from public.enrollments where id = '00000000-0000-0000-0000-0000000000e1') = 'completed', 'enrollment is completed');
select pg_temp.fails($$select public.complete_lesson('00000000-0000-0000-0000-0000000003a1')$$, 'KN404', 'cannot complete a lesson of a draft course');
select pg_temp.fails($$select public.complete_lesson('00000000-0000-0000-0000-0000000002a1')$$, 'KN403', 'cannot complete a lesson without enrolling');

select pg_temp.ok(pg_temp.affected($$insert into public.enrollments (course_id, learner_id) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000b')$$) = 1,
  'learner can self-enroll in a published course');
select pg_temp.ok((public.complete_lesson('00000000-0000-0000-0000-0000000002a1')).progress = 'completed', 'one-lesson course goes straight through to completed');
select pg_temp.ok((select count(*) from public.course_activity_log where event = 'lesson_completed' and actor_id = '00000000-0000-0000-0000-00000000000b') = 4,
  'learner sees their own completion events');
select pg_temp.ok((select count(*) from public.course_activity_log where event = 'lesson_completed' and actor_id = '00000000-0000-0000-0000-00000000000c') = 0,
  'learner does not see another learner''s completion events');
select pg_temp.fails($$select public.reorder_lessons('00000000-0000-0000-0000-0000000000c1', array['00000000-0000-0000-0000-0000000001a1']::uuid[])$$, 'KN403',
  'learner cannot reorder lessons');

reset role;

-- Instructor
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

select pg_temp.ok((select count(*) from public.course_activity_log where course_id = '00000000-0000-0000-0000-0000000000c1') >= 5, 'instructor sees the full log');
select pg_temp.ok(pg_temp.affected($$delete from public.courses where id = '00000000-0000-0000-0000-0000000000c4'$$) = 0, 'instructor cannot delete a course');
select pg_temp.fails($$update public.course_activity_log set message = 'edited'$$, '42501', 'instructor cannot update the log');
select pg_temp.fails($$delete from public.course_activity_log$$, '42501', 'instructor cannot delete from the log');
select pg_temp.fails($$update public.courses set status = 'published' where id = '00000000-0000-0000-0000-0000000000c4'$$, 'KN422', 'publishing an empty course is rejected by the database');
select pg_temp.ok(pg_temp.affected($$update public.courses set status = 'published' where id = '00000000-0000-0000-0000-0000000000c3'$$) = 1, 'publishing a course with a lesson works');
select pg_temp.fails($$update public.courses set status = 'draft' where id = '00000000-0000-0000-0000-0000000000c1'$$, '22000', 'published -> draft is still rejected');

select public.reorder_lessons('00000000-0000-0000-0000-0000000000c1', array['00000000-0000-0000-0000-0000000001a3', '00000000-0000-0000-0000-0000000001a2', '00000000-0000-0000-0000-0000000001a1']::uuid[]);
select pg_temp.ok((select string_agg(title, ',' order by position) from public.lessons where course_id = '00000000-0000-0000-0000-0000000000c1') = 'Three,Two,One', 'reorder applies the requested order');
select pg_temp.fails($$select public.reorder_lessons('00000000-0000-0000-0000-0000000000c1', array['00000000-0000-0000-0000-0000000001a3']::uuid[])$$, 'KN400', 'reorder must list every lesson');
select pg_temp.fails($$select public.reorder_lessons('00000000-0000-0000-0000-0000000000c1', array['00000000-0000-0000-0000-0000000001a3', '00000000-0000-0000-0000-0000000001a3', '00000000-0000-0000-0000-0000000001a1']::uuid[])$$, 'KN400', 'reorder rejects duplicate ids');

select public.delete_lesson('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000001a2');
select pg_temp.ok((select array_agg(position order by position) from public.lessons where course_id = '00000000-0000-0000-0000-0000000000c1') = array[1, 2], 'deleting a lesson closes the position gap');
select pg_temp.fails($$select public.delete_lesson('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000002a1')$$, 'KN409', 'a published course cannot lose its last lesson');
select pg_temp.fails($$delete from public.lessons where course_id = '00000000-0000-0000-0000-0000000000c1'$$, 'KN409', 'a multi-row delete cannot empty a published course');
select pg_temp.fails($$select public.delete_lesson('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000009a9')$$, 'KN404', 'deleting an unknown lesson is a 404');

select pg_temp.ok(pg_temp.affected($$insert into public.enrollments (course_id, learner_id) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000c')$$) = 1, 'instructor can enroll a learner');
select pg_temp.fails($$insert into public.enrollments (course_id, learner_id) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000a')$$, '42501', 'instructor accounts cannot be enrolled');

reset role;

-- Table owner
select pg_temp.fails($$delete from public.courses where id = '00000000-0000-0000-0000-0000000000c4'$$, '23503', 'a course with history cannot be deleted, even by the owner');

rollback;
