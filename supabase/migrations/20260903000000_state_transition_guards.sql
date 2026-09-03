-- Incremental migration for an existing project created from schema.sql.
-- The baseline tables and RLS are kept in supabase/schema.sql for easy review.

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
  return new;
end;
$$;
drop trigger if exists courses_status_transition_guard on public.courses;
create trigger courses_status_transition_guard before update of status on public.courses for each row execute function public.validate_course_status_transition();

create or replace function public.validate_progress_transition() returns trigger
language plpgsql as $$
begin
  if old.progress <> new.progress and not (
    (old.progress = 'not_started' and new.progress = 'in_progress') or
    (old.progress = 'in_progress' and new.progress = 'completed')
  ) then
    raise exception 'Invalid learner progress transition: % -> %', old.progress, new.progress using errcode = '22000';
  end if;
  return new;
end;
$$;
drop trigger if exists enrollments_progress_transition_guard on public.enrollments;
create trigger enrollments_progress_transition_guard before update of progress on public.enrollments for each row execute function public.validate_progress_transition();
