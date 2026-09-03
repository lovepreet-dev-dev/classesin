-- Enrollment request workflow: learners apply to join a published course and
-- the course instructor approves or rejects the request.
create type public.enrollment_request_status as enum ('pending', 'approved', 'rejected');

create table public.enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  status public.enrollment_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);

-- Only one open request per learner per course; past decisions stay as history.
create unique index enrollment_requests_pending_uniq
  on public.enrollment_requests (course_id, learner_id)
  where status = 'pending';

create index enrollment_requests_course_idx on public.enrollment_requests(course_id, status);

alter table public.enrollment_requests enable row level security;

create policy "participants view requests" on public.enrollment_requests for select to authenticated using (
  learner_id = auth.uid()
  or exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = auth.uid())
);

create policy "learners request enrollment" on public.enrollment_requests for insert to authenticated with check (
  learner_id = auth.uid()
  and exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
);

create policy "course instructor decides" on public.enrollment_requests for update to authenticated using (
  exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = auth.uid())
) with check (
  exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = auth.uid())
);

-- Optional activity events for request tracking (safe to run even if the
-- dashboard already shows them).
alter type public.activity_event add value if not exists 'enrollment_requested';
alter type public.activity_event add value if not exists 'enrollment_rejected';
