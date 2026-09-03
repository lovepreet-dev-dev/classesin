# Architecture

The application is a Next.js App Router monolith. Browser pages render the instructor workspace and learner-facing views; client components handle interaction and server routes/actions perform all mutations. Supabase Auth owns email/password sessions and Postgres stores application data. Recharts renders the eight-week completion trend. Vercel is the intended application host and Supabase is the intended database/auth host.

Answer each of these, in your own words, once the system has taken real shape.

- Moving pieces: the sidebar/topbar and dashboard UI, course/lesson screens, server API routes, the Supabase browser/server clients, Postgres constraints/RLS, and immutable activity records. The browser sends authenticated requests; the server obtains the session, checks role and resource access, validates state transitions, writes data, and returns a small result.
- The browser runs in the user’s browser, Next.js server routes run on Vercel, and Supabase Auth/Postgres run as managed services. No service-role key is exposed to the browser.
- Representative action (mark a lesson complete): the learner clicks Complete; the server reads the session and learner enrollment, confirms the lesson belongs to that course, inserts the unique lesson-completion row, calculates whether all lessons are complete, updates the enrollment state/timestamps, appends an activity event, and returns the new progress summary. RLS and unique constraints provide a second enforcement layer.
- Deliberately not built: optional quizzes, certificates, video streaming, discussion threads, email delivery, and a background scheduler. Inactivity is a deterministic query over `last_progress_at`, so it does not need a worker for this scope.
