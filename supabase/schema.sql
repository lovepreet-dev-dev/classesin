-- Kinship course-delivery schema. Run this in the Supabase SQL editor.
create type public.user_role as enum ('instructor', 'learner');
create type public.course_status as enum ('draft', 'published', 'archived');
create type public.progress_status as enum ('not_started', 'in_progress', 'completed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.user_role not null default 'learner',
  created_at timestamptz not null default now()
);
create table public.courses (
  id uuid primary key default gen_random_uuid(), title text not null, description text not null default '', category text not null,
  instructor_id uuid not null references public.profiles(id), status public.course_status not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz, archived_at timestamptz
);
create table public.lessons (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  title text not null, content text not null default '', position integer not null check (position > 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(course_id, position)
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id), learner_id uuid not null references public.profiles(id),
  progress public.progress_status not null default 'not_started', enrolled_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz, last_progress_at timestamptz,
  unique(course_id, learner_id)
);
create table public.lesson_completions (
  id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references public.enrollments(id) on delete cascade, lesson_id uuid not null references public.lessons(id) on delete cascade, completed_at timestamptz not null default now(),
  unique(enrollment_id, lesson_id)
);
create type public.activity_event as enum ('created', 'edited', 'published', 'archived', 'restored', 'commented', 'lesson_completed', 'enrolled', 'alert_dismissed');
create table public.course_activity_log (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade, actor_id uuid references public.profiles(id), event public.activity_event not null,
  message text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table public.alert_dismissals (
  id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references public.enrollments(id) on delete cascade, dismissed_by uuid not null references public.profiles(id), dismissed_at timestamptz not null default now(), dismissed_for_progress_at timestamptz
);
create index courses_status_category_idx on public.courses(status, category);
create index courses_created_idx on public.courses(created_at desc);
create index enrollments_progress_idx on public.enrollments(progress, last_progress_at);
create index activity_course_created_idx on public.course_activity_log(course_id, created_at desc);

-- Database-level transition guards protect the state machine even when a caller
-- bypasses the Next.js routes (for example, a direct authenticated SQL client).
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
create trigger courses_status_transition_guard
before update of status on public.courses
for each row execute function public.validate_course_status_transition();

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
create trigger enrollments_progress_transition_guard
before update of progress on public.enrollments
for each row execute function public.validate_progress_transition();

-- Append-only audit history: no update/delete policy is granted to application roles.
alter table public.course_activity_log enable row level security;
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_completions enable row level security;
alter table public.alert_dismissals enable row level security;

create or replace function public.current_role() returns public.user_role language sql stable security definer set search_path = public as $$ select role from public.profiles where id = auth.uid() $$;
create policy "authenticated profiles" on public.profiles for select to authenticated using (id = auth.uid() or public.current_role() = 'instructor');
create policy "published courses or instructors" on public.courses for select to authenticated using (status = 'published' or public.current_role() = 'instructor');
create policy "instructors manage courses" on public.courses for all to authenticated using (public.current_role() = 'instructor') with check (public.current_role() = 'instructor');
create policy "lessons visible with course" on public.lessons for select to authenticated using (exists (select 1 from courses c where c.id = course_id and (c.status = 'published' or public.current_role() = 'instructor')));
create policy "instructors manage lessons" on public.lessons for all to authenticated using (public.current_role() = 'instructor') with check (public.current_role() = 'instructor');
create policy "own or instructor enrollments" on public.enrollments for select to authenticated using (learner_id = auth.uid() or public.current_role() = 'instructor');
create policy "own enrollment writes" on public.enrollments for insert to authenticated with check ((learner_id = auth.uid()) or public.current_role() = 'instructor');
create policy "own progress writes" on public.enrollments for update to authenticated using (learner_id = auth.uid()) with check (learner_id = auth.uid());
create policy "own completions" on public.lesson_completions for all to authenticated using (exists (select 1 from enrollments e where e.id = enrollment_id and e.learner_id = auth.uid())) with check (exists (select 1 from enrollments e where e.id = enrollment_id and e.learner_id = auth.uid()));
create policy "course activity visible" on public.course_activity_log for select to authenticated using (public.current_role() = 'instructor' or exists (select 1 from enrollments e where e.course_id = course_id and e.learner_id = auth.uid()));
create policy "append activity" on public.course_activity_log for insert to authenticated with check (actor_id = auth.uid() and (public.current_role() = 'instructor' or exists (select 1 from enrollments e where e.course_id = course_id and e.learner_id = auth.uid())));
create policy "instructors manage dismissals" on public.alert_dismissals for all to authenticated using (public.current_role() = 'instructor') with check (public.current_role() = 'instructor');
