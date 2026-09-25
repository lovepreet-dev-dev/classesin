-- Security review fixes for an existing project created from schema.sql.
-- Functions raise SQLSTATE 'KNxxx' where xxx is the HTTP status the route returns.

drop policy if exists "course activity visible" on public.course_activity_log;
create policy "course activity visible" on public.course_activity_log for select to authenticated using (
  public.current_role() = 'instructor'
  or (
    exists (select 1 from public.enrollments e where e.course_id = course_activity_log.course_id and e.learner_id = auth.uid())
    and (
      event in ('created', 'edited', 'published', 'archived', 'restored', 'commented')
      or actor_id = auth.uid()
      or metadata ->> 'learner_id' = auth.uid()::text
    )
  )
);

drop policy if exists "append activity" on public.course_activity_log;
create policy "append activity" on public.course_activity_log for insert to authenticated with check (
  actor_id = auth.uid()
  and (
    public.current_role() = 'instructor'
    or (
      event in ('commented', 'enrolled')
      and exists (select 1 from public.enrollments e where e.course_id = course_activity_log.course_id and e.learner_id = auth.uid())
    )
  )
);

alter table public.course_activity_log drop constraint if exists course_activity_log_course_id_fkey;
alter table public.course_activity_log
  add constraint course_activity_log_course_id_fkey foreign key (course_id) references public.courses(id) on delete restrict;

revoke update, delete, truncate on public.course_activity_log from anon, authenticated;

drop policy if exists "instructors manage courses" on public.courses;
drop policy if exists "instructors create courses" on public.courses;
create policy "instructors create courses" on public.courses for insert to authenticated with check (public.current_role() = 'instructor');
drop policy if exists "instructors edit courses" on public.courses;
create policy "instructors edit courses" on public.courses for update to authenticated using (public.current_role() = 'instructor') with check (public.current_role() = 'instructor');

create or replace function public.validate_course_status_transition() returns trigger
language plpgsql as $$
begin
  if old.status <> new.status and not (
    (old.status = 'draft' and new.status = 'published') or
    (old.status = 'published' and new.status = 'archived') or
    (old.status = 'archived' and new.status = 'published')
  ) then
    raise exception 'Invalid course status transition: % -> %', old.status, new.status using errcode = '22000';
  end if;
  if old.status = 'draft' and new.status = 'published'
     and not exists (select 1 from public.lessons l where l.course_id = new.id) then
    raise exception 'Add at least one lesson before publishing this course' using errcode = 'KN422';
  end if;
  return new;
end;
$$;

drop trigger if exists lessons_keep_one_when_published on public.lessons;
drop function if exists public.guard_last_published_lesson();

drop policy if exists "own enrollment writes" on public.enrollments;
drop policy if exists "enroll into published courses" on public.enrollments;
create policy "enroll into published courses" on public.enrollments for insert to authenticated with check (
  (learner_id = auth.uid() or public.current_role() = 'instructor')
  and progress = 'not_started'
  and started_at is null and completed_at is null and last_progress_at is null
  and exists (select 1 from public.courses c where c.id = enrollments.course_id and c.status = 'published')
  and exists (select 1 from public.profiles p where p.id = enrollments.learner_id and p.role = 'learner')
);
drop policy if exists "own progress writes" on public.enrollments;

drop policy if exists "own completions" on public.lesson_completions;
drop policy if exists "read own or as instructor" on public.lesson_completions;
create policy "read own or as instructor" on public.lesson_completions for select to authenticated using (
  public.current_role() = 'instructor'
  or exists (select 1 from public.enrollments e where e.id = lesson_completions.enrollment_id and e.learner_id = auth.uid())
);

create or replace function public.complete_lesson(p_lesson_id uuid) returns public.enrollments
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_course_id uuid;
  v_enrollment public.enrollments;
  v_total integer;
  v_done integer;
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'KN401';
  end if;

  select l.course_id into v_course_id
  from public.lessons l join public.courses c on c.id = l.course_id
  where l.id = p_lesson_id and c.status = 'published';
  if v_course_id is null then
    raise exception 'Lesson not found' using errcode = 'KN404';
  end if;

  select * into v_enrollment from public.enrollments
  where course_id = v_course_id and learner_id = v_uid
  for update;
  if not found then
    raise exception 'Enroll in this course first' using errcode = 'KN403';
  end if;
  if v_enrollment.progress = 'completed' then
    raise exception 'Completed progress cannot move backwards' using errcode = 'KN409';
  end if;

  insert into public.lesson_completions (enrollment_id, lesson_id, completed_at)
  values (v_enrollment.id, p_lesson_id, v_now)
  on conflict (enrollment_id, lesson_id) do nothing;
  if not found then
    raise exception 'Lesson already completed' using errcode = 'KN409', detail = 'ALREADY_COMPLETED';
  end if;

  select count(*) into v_total from public.lessons where course_id = v_course_id;
  select count(*) into v_done
  from public.lesson_completions lc join public.lessons l on l.id = lc.lesson_id
  where lc.enrollment_id = v_enrollment.id and l.course_id = v_course_id;

  if v_enrollment.progress = 'not_started' then
    update public.enrollments set progress = 'in_progress', started_at = v_now, last_progress_at = v_now
    where id = v_enrollment.id;
  end if;

  if v_done >= v_total then
    update public.enrollments set progress = 'completed', completed_at = v_now, last_progress_at = v_now
    where id = v_enrollment.id returning * into v_enrollment;
  else
    update public.enrollments set last_progress_at = v_now
    where id = v_enrollment.id returning * into v_enrollment;
  end if;

  insert into public.course_activity_log (course_id, actor_id, event, message, metadata)
  values (v_course_id, v_uid, 'lesson_completed', 'Lesson completed', jsonb_build_object('lesson_id', p_lesson_id));

  return v_enrollment;
end;
$$;

create or replace function public.reorder_lessons(p_course_id uuid, p_lesson_ids uuid[]) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_offset integer;
begin
  if public.current_role() is distinct from 'instructor' then
    raise exception 'Instructor access required' using errcode = 'KN403';
  end if;
  if coalesce(array_length(p_lesson_ids, 1), 0) = 0
     or (select count(distinct req.lesson_id) from unnest(p_lesson_ids) as req(lesson_id)) <> array_length(p_lesson_ids, 1) then
    raise exception 'lessonIds must be a non-empty list of unique IDs' using errcode = 'KN400';
  end if;
  if (select count(*) from public.lessons l where l.course_id = p_course_id) <> array_length(p_lesson_ids, 1)
     or exists (
       select 1 from unnest(p_lesson_ids) as req(lesson_id)
       where not exists (select 1 from public.lessons l where l.id = req.lesson_id and l.course_id = p_course_id)
     ) then
    raise exception 'The reorder list must contain every lesson in this course' using errcode = 'KN400';
  end if;

  select coalesce(max(position), 0) + array_length(p_lesson_ids, 1) + 1 into v_offset from public.lessons where course_id = p_course_id;
  update public.lessons l set position = v_offset + o.ord
  from unnest(p_lesson_ids) with ordinality as o(id, ord) where l.id = o.id and l.course_id = p_course_id;
  update public.lessons l set position = o.ord, updated_at = now()
  from unnest(p_lesson_ids) with ordinality as o(id, ord) where l.id = o.id and l.course_id = p_course_id;

  update public.courses set updated_at = now() where id = p_course_id;
  insert into public.course_activity_log (course_id, actor_id, event, message, metadata)
  values (p_course_id, auth.uid(), 'edited', 'Lesson order updated', jsonb_build_object('lesson_ids', to_jsonb(p_lesson_ids)));
end;
$$;

create or replace function public.delete_lesson(p_course_id uuid, p_lesson_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if public.current_role() is distinct from 'instructor' then
    raise exception 'Instructor access required' using errcode = 'KN403';
  end if;
  delete from public.lessons where id = p_lesson_id and course_id = p_course_id;
  if not found then
    raise exception 'Lesson not found' using errcode = 'KN404';
  end if;

  with ordered as (
    select id, row_number() over (order by position) as ord from public.lessons where course_id = p_course_id
  )
  update public.lessons l set position = ordered.ord + 1000000 from ordered where l.id = ordered.id;
  with ordered as (
    select id, row_number() over (order by position) as ord from public.lessons where course_id = p_course_id
  )
  update public.lessons l set position = ordered.ord, updated_at = now() from ordered where l.id = ordered.id;

  update public.courses set updated_at = now() where id = p_course_id;
  insert into public.course_activity_log (course_id, actor_id, event, message, metadata)
  values (p_course_id, auth.uid(), 'edited', 'Lesson removed', jsonb_build_object('lesson_id', p_lesson_id));
end;
$$;

revoke execute on function public.complete_lesson(uuid) from public, anon;
revoke execute on function public.reorder_lessons(uuid, uuid[]) from public, anon;
revoke execute on function public.delete_lesson(uuid, uuid) from public, anon;
grant execute on function public.complete_lesson(uuid) to authenticated;
grant execute on function public.reorder_lessons(uuid, uuid[]) to authenticated;
grant execute on function public.delete_lesson(uuid, uuid) to authenticated;
