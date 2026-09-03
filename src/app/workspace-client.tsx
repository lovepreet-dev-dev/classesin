"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowUpRight, Bell, BookOpen, CheckCircle2, ChevronDown, Clock3, FileText, Filter, GraduationCap, LayoutDashboard, Library, Loader2, LogOut, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Sparkles, Upload, UserPlus, Users, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase/client";

export type WorkspaceProfile = { id: string; fullName: string; email: string; role: "Instructor" | "Learner" };

type Status = "Published" | "Draft" | "Archived";
type Progress = "Not started" | "In progress" | "Completed";
type Tone = "coral" | "lavender" | "mint" | "yellow" | "blue" | "slate";
type Course = { id: string; title: string; description: string; category: string; instructor: string | null; status: Status; lessons: number; learners: number; progress?: Progress; updated: string; accent: Tone };
type PersonRow = { id: string; name: string; email: string; courses: number; progress: Progress; lastActive: string; tone: Tone };
type Alert = { id: string; enrollmentId: string; name: string; initials: string; course: string; days: number; tone: Tone };
type BulkResult = { email: string; status: "unknown" | "already_enrolled" | "newly_enrolled" | "error" };
type ActivityItem = { id: string; t: string; d: string; by: string; when: string; event: string };
type InstructorOption = { id: string; fullName: string };
type DashboardData = {
  totalLearners: number; publishedCourses: number; completionsThisMonth: number; inProgress: number; completionTotal: number;
  weekly: { week: string; completions: number }[];
  courseBreakdown: { course: string; enrolled: number; completed: number; inProgress: number; notStarted: number }[];
  progressBreakdown: { progress: string; count: number }[];
};

const categories = ["All categories", "Compliance", "Leadership", "Skills", "People", "Product", "Operations", "Communication"];
const tones: Tone[] = ["lavender", "coral", "mint", "yellow", "blue", "slate"];
const accentByCategory: Record<string, Tone> = { Compliance: "coral", Leadership: "lavender", Skills: "mint", People: "blue", Product: "yellow", Operations: "slate", Communication: "coral" };
const emptyDashboard: DashboardData = { totalLearners: 0, publishedCourses: 0, completionsThisMonth: 0, inProgress: 0, completionTotal: 0, weekly: [], courseBreakdown: [], progressBreakdown: [] };

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone.toLowerCase().replaceAll(" ", "-")}`}>{children}</span>;
}

function Avatar({ initials, tone = "lavender" }: { initials: string; tone?: string }) {
  return <span className={`avatar avatar-${tone}`}>{initials}</span>;
}

function ProgressBar({ value, tone = "coral" }: { value: number; tone?: string }) {
  return <div className="progress-track"><div className={`progress-fill fill-${tone}`} style={{ width: `${value}%` }} /></div>;
}

function initialsFor(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function titleCase(value: string) {
  return value[0].toUpperCase() + value.slice(1).replaceAll("_", " ");
}

function mapCourse(item: {
  id: string; title: string; description: string; category: string; status: string; updated_at?: string;
  profiles?: { full_name?: string } | { full_name?: string }[];
  enrollments?: { count?: number }[];
  lessons?: { count?: number }[];
}): Course {
  const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
  const learners = Array.isArray(item.enrollments) ? item.enrollments.reduce((total, row) => total + Number(row.count ?? 0), 0) : 0;
  const lessons = Array.isArray(item.lessons) ? item.lessons.reduce((total, row) => total + Number(row.count ?? 0), 0) : 0;
  return {
    id: item.id, title: item.title, description: item.description, category: item.category,
    instructor: profile?.full_name ?? null,
    status: titleCase(item.status) as Status,
    lessons, learners,
    updated: item.updated_at ? new Date(item.updated_at).toLocaleDateString() : "Recently",
    accent: accentByCategory[item.category] ?? "slate",
  };
}

export default function WorkspaceClient({ profile }: { profile: WorkspaceProfile }) {
  const role = profile.role;
  const isInstructor = role === "Instructor";
  const router = useRouter();
  const [active, setActive] = useState("Overview");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All statuses");
  const [instructorFilter, setInstructorFilter] = useState("All instructors");
  const [sort, setSort] = useState("Newest");
  const [page, setPage] = useState(1);
  const [serverCount, setServerCount] = useState(0);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [courseData, setCourseData] = useState<Course[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [enrollmentProgress, setEnrollmentProgress] = useState<Record<string, Progress>>({});
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [toast, setToast] = useState("");
  const pageSize = 8;
  const firstName = profile.fullName.split(" ")[0];

  const loadingCourses = query !== deferredQuery || !coursesLoaded;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: sort === "Alphabetical" ? "title" : sort === "Learners" ? "enrollment_count" : "created_at" });
    if (deferredQuery) params.set("q", deferredQuery);
    if (category !== "All categories") params.set("category", category);
    if (status !== "All statuses") params.set("status", status.toLowerCase());
    if (isInstructor && instructorFilter !== "All instructors") {
      const instructor = instructors.find((person) => person.fullName === instructorFilter);
      if (instructor) params.set("instructor", instructor.id);
    }
    fetch(`/api/courses?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        if (!Array.isArray(payload.data)) return;
        setCourseData(payload.data.map(mapCourse));
        setServerCount(Number(payload.count ?? payload.data.length));
        setCoursesLoaded(true);
      })
      .catch((error) => { if (error?.name !== "AbortError") setToast("Could not load courses — try refreshing."); });
    return () => controller.abort();
  }, [deferredQuery, category, status, instructorFilter, sort, page, isInstructor, instructors]);

  useEffect(() => {
    if (!isInstructor) return;
    fetch("/api/instructors").then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json();
      setInstructors((payload.instructors ?? []).map((item: { id: string; full_name: string }) => ({ id: item.id, fullName: item.full_name })));
    }).catch(() => undefined);
  }, [isInstructor]);

  useEffect(() => {
    if (isInstructor) return;
    fetch("/api/enrollments").then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json();
      const enrollments = (payload.enrollments ?? []) as { progress: string; courses?: { id: string; title: string; description: string; category: string; status: string; updated_at?: string; profiles?: { full_name?: string } | { full_name?: string }[]; lessons?: unknown[] } | null }[];
      const rows: Course[] = [];
      const progressByCourse: Record<string, Progress> = {};
      for (const item of enrollments) {
        const course = item.courses;
        if (!course) continue;
        const profileData = Array.isArray(course.profiles) ? course.profiles[0] : course.profiles;
        rows.push({
          id: course.id, title: course.title, description: course.description, category: course.category,
          instructor: profileData?.full_name ?? null,
          status: titleCase(course.status) as Status,
          lessons: course.lessons?.length ?? 0, learners: 0,
          progress: titleCase(item.progress) as Progress,
          updated: "Enrolled course",
          accent: accentByCategory[course.category] ?? "slate",
        });
        progressByCourse[course.id] = titleCase(item.progress) as Progress;
      }
      setEnrolledCourses(rows);
      setEnrollmentProgress(progressByCourse);
    }).catch(() => undefined);
  }, [isInstructor]);

  useEffect(() => {
    if (!isInstructor) return;
    fetch("/api/dashboard").then(async (response) => { if (response.ok) setDashboard(await response.json()); }).catch(() => undefined);
    fetch("/api/alerts").then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json();
      setAlerts((payload.alerts ?? []).map((item: { id: string; last_progress_at?: string; courses?: { title?: string } | { title?: string }[]; profiles?: { full_name?: string } | { full_name?: string }[] }, index: number) => {
        const course = Array.isArray(item.courses) ? item.courses[0] : item.courses;
        const learner = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        const name = learner?.full_name ?? "Learner";
        return {
          id: item.id, enrollmentId: item.id, name, initials: initialsFor(name),
          course: course?.title ?? "Course",
          days: item.last_progress_at ? Math.max(15, Math.floor((Date.now() - new Date(item.last_progress_at).getTime()) / 86400000)) : 15,
          tone: tones[index % tones.length],
        };
      }));
    }).catch(() => undefined);
    fetch("/api/people").then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json();
      setPeople((payload.people ?? []).map((item: { id: string; full_name: string; email: string; courses: number; progress: string; last_active: string | null }, index: number) => ({ id: item.id, name: item.full_name, email: item.email, courses: item.courses, progress: titleCase(item.progress) as Progress, lastActive: item.last_active ? new Date(item.last_active).toLocaleDateString() : "Not started", tone: tones[index % tones.length] })));
    }).catch(() => undefined);
    fetch("/api/activity").then(async (response) => { if (response.ok) setActivity((await response.json()).activity ?? []); }).catch(() => undefined);
  }, [isInstructor]);

  const filtered = useMemo(() => {
    const source = isInstructor ? courseData : courseData.map((course) => ({ ...course, progress: enrollmentProgress[course.id] ?? course.progress }));
    return source;
  }, [courseData, enrollmentProgress, isInstructor]);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2800); }
  function clearFilters() { setQuery(""); setCategory("All categories"); setStatus("All statuses"); setInstructorFilter("All instructors"); setSort("Newest"); setPage(1); setShowFilters(false); }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  async function createCourse(input: { title: string; description: string; category: string }) {
    const response = await fetch("/api/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not create course");
    setShowCreate(false);
    setPage(1);
    notify("Draft course created");
  }

  async function bulkEnroll(input: { courseId: string; emails: string[] }) {
    const response = await fetch("/api/enrollments/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not enroll learners");
    notify(`${(result.results ?? []).filter((row: BulkResult) => row.status === "newly_enrolled").length} new learners enrolled`);
    return result.results ?? [];
  }

  async function dismissAlert(alert: Alert) {
    const response = await fetch("/api/alerts/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enrollmentId: alert.enrollmentId }) });
    if (!response.ok) { notify("Could not dismiss that alert"); return; }
    setAlerts((items) => items.filter((item) => item.id !== alert.id));
    notify(`${alert.name}’s alert dismissed`);
  }

  const totalMatches = serverCount;
  const table = <CourseTable courses={filtered} role={role} loading={loadingCourses} />;
  const dashboardBreakdown = <DashboardBreakdown dashboard={dashboard} />;
  const navItems = isInstructor
    ? [{ label: "Overview", icon: LayoutDashboard }, { label: "Courses", icon: Library }, { label: "Learners", icon: Users }, { label: "Activity", icon: Activity }]
    : [{ label: "Overview", icon: LayoutDashboard }, { label: "Courses", icon: Library }];

  const learnerStats = [
    { label: "Enrolled courses", value: enrolledCourses.length, icon: <BookOpen size={18} />, tone: "lavender", delta: "", detail: "keep the streak going" },
    { label: "In progress", value: enrolledCourses.filter((course) => course.progress === "In progress").length, icon: <Clock3 size={18} />, tone: "coral", delta: "", detail: "finish a lesson today" },
    { label: "Completed", value: enrolledCourses.filter((course) => course.progress === "Completed").length, icon: <CheckCircle2 size={18} />, tone: "mint", delta: "", detail: "well done" },
    { label: "Not started", value: enrolledCourses.filter((course) => course.progress === "Not started").length, icon: <Clock3 size={18} />, tone: "yellow", delta: "", detail: "start when you’re ready" },
  ];

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><GraduationCap size={21} /></span><span>kinship<span className="brand-dot">.</span></span></div>
      <button className="workspace-switcher" onClick={() => notify("Workspace switching is available for team accounts.")}>
        <div className="workspace-avatar">N</div><div><strong>Northstar Inc.</strong><small>Learning workspace</small></div><ChevronDown size={15} />
      </button>
      <p className="eyebrow nav-label">Workspace</p>
      <nav className="primary-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return <button key={item.label} className={active === item.label ? "nav-item active" : "nav-item"} onClick={() => setActive(item.label)}><Icon size={18} />{item.label}{isInstructor && item.label === "Activity" && alerts.length > 0 && <span className="nav-count">{alerts.length}</span>}</button>;
        })}
      </nav>
      {isInstructor && <>
        <p className="eyebrow nav-label second">Manage</p>
        <nav className="primary-nav">
          <button className="nav-item" onClick={() => setShowCreate(true)}><Plus size={18} />New course</button>
          <button className="nav-item" onClick={() => notify("Workspace settings are managed by your administrator.")}><Settings size={18} />Settings</button>
        </nav>
      </>}
      <div className="sidebar-spacer" />
      <button className="sidebar-help" onClick={() => notify("You’re up to date with the latest Kinship updates.")}>
        <Sparkles size={17} /><div><strong>Make learning stick</strong><span>See what’s new in Kinship</span></div><ArrowUpRight size={15} />
      </button>
      <div className="profile-row">
        <Avatar initials={initialsFor(profile.fullName)} tone={isInstructor ? "coral" : "lavender"} />
        <div><strong>{profile.fullName}</strong><small>{role}</small></div>
        <button className="icon-button subtle" aria-label="Sign out" onClick={signOut}><LogOut size={16} /></button>
      </div>
    </aside>
    <section className="main-content">
      <header className="topbar">
        <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{active}</strong></div>
        <div className="topbar-actions">
          {isInstructor && <button className="icon-button" aria-label="Notifications" onClick={() => setActive("Activity")}><Bell size={19} />{alerts.length > 0 && <span className="notification-dot" />}</button>}
          <button className="icon-button" aria-label="Sign out" onClick={signOut}><Avatar initials={initialsFor(profile.fullName)} tone={isInstructor ? "coral" : "lavender"} /></button>
        </div>
      </header>
      <div className="content-wrap">
        {active === "Overview" && (isInstructor ? <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">{todayLabel()}</p>
              <h1>Good morning, {firstName} <span className="wave">✦</span></h1>
              <p className="subhead">Here’s what’s happening across your learning workspace.</p>
            </div>
            <button className="button button-primary" onClick={() => setShowCreate(true)}><Plus size={17} /> Create course</button>
          </div>
          <div className="metric-grid">
            <MetricCard label="Total learners" value={String(dashboard.totalLearners)} delta="" detail="registered learners" icon={<Users size={18} />} tone="lavender" />
            <MetricCard label="Published courses" value={String(dashboard.publishedCourses)} delta="" detail="live in the catalog" icon={<BookOpen size={18} />} tone="mint" />
            <MetricCard label="Completions this month" value={String(dashboard.completionsThisMonth)} delta="" detail="courses finished" icon={<CheckCircle2 size={18} />} tone="yellow" />
            <MetricCard label="In progress" value={String(dashboard.inProgress)} delta="" detail="learners currently active" icon={<Clock3 size={18} />} tone="coral" />
          </div>
          <div className="dashboard-grid">
            <section className="panel chart-panel">
              <div className="panel-header"><div><p className="eyebrow">Momentum</p><h2>Completions over time</h2></div><span className="chart-total">{dashboard.completionTotal} <small>last 8 weeks</small></span></div>
              <div className="chart-legend"><span><i className="legend-dot coral-dot" />Completions</span></div>
              <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard.weekly} margin={{ top: 10, right: 8, left: -28, bottom: 0 }}>
                  <defs><linearGradient id="coralGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f47f6b" stopOpacity={0.32} /><stop offset="100%" stopColor="#f47f6b" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="#eeeae4" />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: "#918b83", fontSize: 11 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#918b83", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #ebe6df", boxShadow: "0 8px 24px rgba(47,43,38,.1)" }} />
                  <Area type="monotone" dataKey="completions" stroke="#e96e5a" strokeWidth={2.5} fill="url(#coralGradient)" />
                </AreaChart>
              </ResponsiveContainer></div>
            </section>
            <section className="panel alerts-panel">
              <div className="panel-header"><div><p className="eyebrow">Needs a nudge</p><h2>Inactivity alerts <span className="count-pill">{alerts.length}</span></h2></div><button className="text-button" onClick={() => setActive("Activity")}>View all <ArrowUpRight size={14} /></button></div>
              <p className="panel-caption">Learners who haven’t made progress in 14+ days.</p>
              <div className="alert-list">{alerts.map((alert) => <div className="alert-row" key={alert.id}><Avatar initials={alert.initials} tone={alert.tone} /><div className="alert-copy"><strong>{alert.name}</strong><span>{alert.course}</span></div><span className="alert-days">{alert.days}d quiet</span><button className="dismiss-button" aria-label={`Dismiss ${alert.name} alert`} onClick={() => dismissAlert(alert)}><X size={14} /></button></div>)}</div>
              {alerts.length === 0 && <div className="empty-alerts"><ShieldCheck size={24} /><span>All caught up for now.</span></div>}
            </section>
          </div>
          {dashboardBreakdown}
          <section className="panel course-panel">
            <div className="panel-header course-panel-header">
              <div><p className="eyebrow">Your library</p><h2>Courses <span className="count-pill soft">{totalMatches}</span></h2></div>
              <button className="text-button" onClick={() => setActive("Courses")}>Manage courses <ArrowUpRight size={14} /></button>
            </div>
            <CourseToolbar query={query} setQuery={setQuery} category={category} setCategory={setCategory} status={status} setStatus={setStatus} instructorFilter={instructorFilter} setInstructorFilter={setInstructorFilter} sort={sort} setSort={setSort} showFilters={showFilters} setShowFilters={setShowFilters} clearFilters={clearFilters} instructors={instructors} />
            {table}
          </section>
        </> : <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">{todayLabel()}</p>
              <h1>Good morning, {firstName} <span className="wave">✦</span></h1>
              <p className="subhead">Pick up where you left off, or browse the catalog for something new.</p>
            </div>
            <button className="button button-primary" onClick={() => setActive("Courses")}><Library size={17} /> Browse courses</button>
          </div>
          <div className="metric-grid">{learnerStats.map((stat) => <MetricCard key={stat.label} label={stat.label} value={String(stat.value)} delta={stat.delta} detail={stat.detail} icon={stat.icon} tone={stat.tone} />)}</div>
          <section className="panel course-panel">
            <div className="panel-header course-panel-header">
              <div><p className="eyebrow">Your learning</p><h2>My courses <span className="count-pill soft">{enrolledCourses.length}</span></h2></div>
              <button className="text-button" onClick={() => setActive("Courses")}>Find more courses <ArrowUpRight size={14} /></button>
            </div>
            <CourseTable courses={enrolledCourses} role="Learner" loading={false} />
          </section>
        </>)}
        {active !== "Overview" && <SecondaryView active={active} filtered={filtered} totalMatches={totalMatches} page={page} pageSize={pageSize} setPage={setPage} role={role} query={query} setQuery={setQuery} category={category} setCategory={setCategory} status={status} setStatus={setStatus} instructorFilter={instructorFilter} setInstructorFilter={setInstructorFilter} sort={sort} setSort={setSort} showFilters={showFilters} setShowFilters={setShowFilters} clearFilters={clearFilters} people={people} activity={activity} alerts={alerts} onCreate={() => setShowCreate(true)} onBulk={() => setShowBulk(true)} instructors={instructors} coursesLoaded={coursesLoaded} />}
      </div>
    </section>
    {showCreate && <CreateModal owner={profile.fullName} onClose={() => setShowCreate(false)} onSave={createCourse} />}
    {showBulk && <BulkModal courses={courseData.filter((course) => course.status === "Published")} onClose={() => setShowBulk(false)} onSave={bulkEnroll} />}
    {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}</div>}
  </main>;
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function MetricCard({ label, value, delta, detail, icon, tone }: { label: string; value: string; delta: string; detail: string; icon: React.ReactNode; tone: string }) {
  return <div className="metric-card"><div className={`metric-icon icon-${tone}`}>{icon}</div><p>{label}</p><div className="metric-value">{value}</div><div className="metric-change">{delta && <span>{delta}</span>} {detail}</div></div>;
}

function CourseToolbar({ query, setQuery, category, setCategory, status, setStatus, instructorFilter, setInstructorFilter, sort, setSort, showFilters, setShowFilters, clearFilters, instructors }: {
  query: string; setQuery: (value: string) => void; category: string; setCategory: (value: string) => void; status: string; setStatus: (value: string) => void;
  instructorFilter: string; setInstructorFilter: (value: string) => void; sort: string; setSort: (value: string) => void;
  showFilters: boolean; setShowFilters: (value: boolean) => void; clearFilters: () => void; instructors: InstructorOption[];
}) {
  return <div className="toolbar filter-toolbar">
    <div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses" /></div>
    <button className={`filter-button ${showFilters ? "active" : ""}`} onClick={() => setShowFilters(!showFilters)}><Filter size={15} /> Filters <ChevronDown size={13} /></button>
    <select aria-label="Course category" className="select-button native-select" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
    <select aria-label="Course sort" className="select-button native-select" value={sort} onChange={(event) => setSort(event.target.value)}><option>Newest</option><option>Alphabetical</option><option>Learners</option></select>
    {showFilters && <div className="filter-popover">
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option><option>Published</option><option>Draft</option><option>Archived</option></select></label>
      <label>Instructor<select value={instructorFilter} onChange={(event) => setInstructorFilter(event.target.value)}><option>All instructors</option>{instructors.map((person) => <option key={person.id}>{person.fullName}</option>)}</select></label>
      <button className="text-button" onClick={clearFilters}>Clear filters</button>
    </div>}
  </div>;
}

function CourseTable({ courses, role, loading }: { courses: Course[]; role: "Instructor" | "Learner"; loading: boolean }) {
  return <div className="course-table">
    <div className="table-head"><span>Course</span><span>Status</span><span>Learners</span><span>Progress</span><span>Last updated</span><span /></div>
    {loading ? <CourseTableSkeleton /> : courses.length ? courses.map((course) => <CourseRow key={course.id} course={course} role={role} />) : <EmptyCourseState />}
  </div>;
}

function CourseRow({ course, role }: { course: Course; role: "Instructor" | "Learner" }) {
  const router = useRouter();
  const values: Record<string, number> = { "Not started": 0, "In progress": 58, Completed: 100, "Not enrolled": 0 };
  const open = () => router.push(`/courses/${course.id}`);
  return <div className="course-row" role="link" tabIndex={0} onClick={open} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } }}>
    <div className="course-title-cell">
      <div className={`course-thumb thumb-${course.accent}`}><FileText size={19} /></div>
      <div><Link href={`/courses/${course.id}`} className="course-link" onClick={(event) => event.stopPropagation()}>{course.title}</Link><span>{course.category} <i /> {course.lessons} lessons</span></div>
    </div>
    <div><Badge tone={course.status}>{course.status}</Badge></div>
    <div className="learner-count"><Users size={14} /> {course.learners}</div>
    <div className="progress-cell">
      {role === "Learner"
        ? <><ProgressBar value={values[course.progress ?? "Not enrolled"] ?? 0} tone={course.progress === "Completed" ? "mint" : "coral"} /><small>{course.progress ?? "Not enrolled"}</small></>
        : <small>—</small>}
    </div>
    <div className="updated-cell">{course.updated}</div>
    <span className="row-menu" aria-hidden><MoreHorizontal size={17} /></span>
  </div>;
}

function CourseTableSkeleton() {
  return <>{[1, 2, 3, 4].map((item) => <div className="course-row skeleton-row" key={item}><span /><span /><span /><span /><span /><span /></div>)}</>;
}

function EmptyCourseState() {
  return <div className="empty-course"><Search size={22} /><strong>No courses match those filters</strong><span>Try a different search or reset the filters.</span></div>;
}

function SecondaryView({ active, filtered, totalMatches, page, pageSize, setPage, role, query, setQuery, category, setCategory, status, setStatus, instructorFilter, setInstructorFilter, sort, setSort, showFilters, setShowFilters, clearFilters, people, activity, alerts, onCreate, onBulk, instructors, coursesLoaded }: {
  active: string; filtered: Course[]; totalMatches: number; page: number; pageSize: number; setPage: (value: number) => void; role: "Instructor" | "Learner";
  query: string; setQuery: (value: string) => void; category: string; setCategory: (value: string) => void; status: string; setStatus: (value: string) => void;
  instructorFilter: string; setInstructorFilter: (value: string) => void; sort: string; setSort: (value: string) => void;
  showFilters: boolean; setShowFilters: (value: boolean) => void; clearFilters: () => void;
  people: PersonRow[]; activity: ActivityItem[]; alerts: Alert[]; onCreate: () => void; onBulk: () => void; instructors: InstructorOption[]; coursesLoaded: boolean;
}) {
  const isInstructor = role === "Instructor";
  const totalPages = Math.max(1, Math.ceil(totalMatches / pageSize));
  const visibleCourses = filtered;
  return <div className="secondary-view">
    <div className="page-heading">
      <div>
        <p className="eyebrow">Workspace</p>
        <h1>{active}</h1>
        <p className="subhead">{active === "Courses" ? (isInstructor ? "Build, publish, and improve learning that moves your team forward." : "Published courses you can join at your own pace.") : active === "Learners" ? "See who is learning, progressing, and ready for recognition." : "A permanent record of course changes and learner activity."}</p>
      </div>
      {isInstructor && active === "Courses" && <button className="button button-primary" onClick={onCreate}><Plus size={17} /> Create course</button>}
      {isInstructor && active === "Learners" && <button className="button button-primary" onClick={onBulk}><Upload size={17} /> Bulk enroll</button>}
    </div>
    {active === "Courses" ? <section className="panel course-panel">
      <CourseToolbar query={query} setQuery={setQuery} category={category} setCategory={setCategory} status={status} setStatus={setStatus} instructorFilter={instructorFilter} setInstructorFilter={setInstructorFilter} sort={sort} setSort={setSort} showFilters={showFilters} setShowFilters={setShowFilters} clearFilters={clearFilters} instructors={instructors} />
      <CourseTable courses={visibleCourses} role={role} loading={!coursesLoaded} />
      <div className="pagination">
        <span>Showing {totalMatches ? ((page - 1) * pageSize) + 1 : 0}–{Math.min(page * pageSize, totalMatches)} of {totalMatches} courses</span>
        <div>
          <button disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}>‹</button>
          <button className="current">{page}</button>
          <button disabled={page >= totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))}>›</button>
        </div>
      </div>
    </section>
      : active === "Learners" ? <LearnersView people={people} onBulk={onBulk} />
        : <ActivityView activity={activity} alerts={alerts} />}
  </div>;
}

function LearnersView({ people, onBulk }: { people: PersonRow[]; onBulk: () => void }) {
  const [search, setSearch] = useState("");
  const visible = people.filter((person) => `${person.name} ${person.email}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="panel course-panel">
    <div className="panel-header">
      <div><p className="eyebrow">{people.length} total learners</p><h2>All learners</h2></div>
      <button className="button button-secondary" onClick={onBulk}><Upload size={16} /> Bulk enroll</button>
    </div>
    <div className="toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search learners" /></div></div>
    <div className="learner-table">
      <div className="table-head"><span>Learner</span><span>Courses</span><span>Latest status</span><span>Last active</span><span /></div>
      {visible.map((person) => <div className="learner-row" key={person.id}>
        <div className="course-title-cell"><Avatar initials={initialsFor(person.name)} tone={person.tone} /><div><strong>{person.name}</strong><span>{person.email}</span></div></div>
        <span>{person.courses} courses</span>
        <Badge tone={person.progress}>{person.progress}</Badge>
        <span className="updated-cell">{person.lastActive}</span>
        <span className="icon-button subtle" aria-hidden><MoreHorizontal size={17} /></span>
      </div>)}
      {visible.length === 0 && <div className="empty-course"><Search size={22} /><strong>No learners found</strong><span>Try a different search.</span></div>}
    </div>
  </section>;
}

function ActivityView({ activity, alerts }: { activity: ActivityItem[]; alerts: Alert[] }) {
  return <section className="panel course-panel">
    <div className="panel-header"><div><p className="eyebrow">Immutable history</p><h2>Activity log</h2></div></div>
    <p className="panel-caption">Every publish, edit, enrollment, completion, comment, and alert dismissal is recorded.</p>
    {alerts.length > 0 && <div className="activity-alert-summary"><Bell size={15} /> {alerts.length} active inactivity {alerts.length === 1 ? "alert" : "alerts"} <span>· dismiss from Overview</span></div>}
    <div className="activity-list">{activity.map((item) => <div className="activity-row" key={item.id}>
      <div className="activity-icon">{item.event === "lesson_completed" ? <CheckCircle2 size={16} /> : item.event === "enrolled" ? <UserPlus size={16} /> : item.event === "archived" ? <Activity size={16} /> : <BookOpen size={16} />}</div>
      <div><strong>{item.t}</strong><p>{item.d}</p><span>By {item.by}</span></div><time>{item.when}</time>
    </div>)}</div>
  </section>;
}

function CreateModal({ owner, onClose, onSave }: { owner: string; onClose: () => void; onSave: (input: { title: string; description: string; category: string }) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Compliance");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setSaving(true); setError("");
    try { await onSave({ title: title.trim(), description: description.trim(), category }); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not create course"); }
    finally { setSaving(false); }
  }
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-course-title" onClick={(event) => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">Course builder</p><h2 id="create-course-title">Create a course</h2></div><button className="icon-button subtle" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
      <p className="modal-copy">Start with the essentials. Add lessons in the course builder before publishing.</p>
      <label>Course title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Security foundations" /></label>
      <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will learners be able to do after this course?" rows={3} /></label>
      <div className="two-fields">
        <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Owner<select disabled><option>{owner}</option></select></label>
      </div>
      {error && <p className="modal-error">{error}</p>}
      <div className="modal-actions">
        <button className="button button-secondary" onClick={onClose}>Cancel</button>
        <button className="button button-primary" disabled={!title.trim() || saving} onClick={save}>{saving ? <><Loader2 size={16} className="spin" /> Creating…</> : <><Plus size={16} /> Create draft</>}</button>
      </div>
    </div>
  </div>;
}

function BulkModal({ courses, onClose, onSave }: { courses: Course[]; onClose: () => void; onSave: (input: { courseId: string; emails: string[] }) => Promise<BulkResult[]> }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [emails, setEmails] = useState("");
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [error, setError] = useState("");
  function importCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result ?? "").split(/\r?\n/).map((line) => line.split(",")[0]?.trim().replaceAll('"', "") ?? "");
      if (lines.length && /^[,"'\s]*email/i.test(lines[0])) lines.shift();
      setEmails(lines.filter(Boolean).join("\n"));
    };
    reader.readAsText(file);
  }
  async function save() {
    setSaving(true); setError("");
    try {
      const result = await onSave({ courseId, emails: [...new Set(emails.split(/[\n,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))] });
      setResults(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enroll learners");
    } finally {
      setSaving(false);
    }
  }
  const statusLabel: Record<BulkResult["status"], string> = { newly_enrolled: "Newly enrolled", already_enrolled: "Already enrolled", unknown: "Unknown address", error: "Could not process" };
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal bulk-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-title" onClick={(event) => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">Enrollment tools</p><h2 id="bulk-title">Bulk enroll learners</h2></div><button className="icon-button subtle" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
      {results ? <>
        <p className="modal-copy">Each address has been checked. Nothing is hidden when an address is unknown or already enrolled.</p>
        <div className="bulk-summary">
          <strong>{results.filter((row) => row.status === "newly_enrolled").length} newly enrolled</strong>
          <span>{results.filter((row) => row.status === "already_enrolled").length} already enrolled</span>
          <span>{results.filter((row) => row.status === "unknown").length} unknown</span>
        </div>
        <div className="bulk-results">{results.map((row) => <div key={row.email}><span>{row.email}</span><Badge tone={row.status === "newly_enrolled" ? "Completed" : row.status === "unknown" ? "Archived" : "Draft"}>{statusLabel[row.status]}</Badge></div>)}</div>
        <div className="modal-actions"><button className="button button-primary" onClick={onClose}>Done</button></div>
      </> : <>
        <p className="modal-copy">Paste one email per line or upload a CSV. We’ll check each address and report the result.</p>
        <label>Course<select value={courseId} onChange={(event) => setCourseId(event.target.value)}>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        <label>Email addresses<textarea value={emails} onChange={(event) => setEmails(event.target.value)} placeholder={'learner@northstar.co\nnew.joiner@northstar.co'} rows={5} /></label>
        <label className="upload-drop"><Upload size={18} /><span><strong>Upload CSV</strong><small>or choose a file from your computer</small></span><input type="file" accept=".csv,text/csv" onChange={importCsv} /></label>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button className="button button-secondary" onClick={onClose}>Cancel</button>
          <button className="button button-primary" disabled={!courseId || !emails.trim() || saving} onClick={save}>{saving ? <><Loader2 size={16} className="spin" /> Reviewing…</> : <><Users size={16} /> Review enrollments</>}</button>
        </div>
      </>}
    </div>
  </div>;
}

function DashboardBreakdown({ dashboard }: { dashboard: DashboardData }) {
  const labels: Record<string, string> = { completed: "Completed", in_progress: "In progress", not_started: "Not started" };
  const totalProgress = dashboard.progressBreakdown.reduce((sum, item) => sum + item.count, 0);
  return <div className="dashboard-breakdown-grid">
    <section className="panel breakdown-panel">
      <div className="panel-header"><div><p className="eyebrow">Enrollment mix</p><h2>By course</h2></div><span className="breakdown-caption">{dashboard.courseBreakdown.length} courses</span></div>
      <div className="breakdown-course-list">{dashboard.courseBreakdown.slice(0, 6).map((item) => <div className="breakdown-course" key={item.course}>
        <div className="breakdown-course-heading"><strong>{item.course}</strong><span>{item.enrolled} enrolled</span></div>
        <div className="breakdown-bar"><i style={{ width: String(item.enrolled ? (item.completed / item.enrolled) * 100 : 0) + "%" }} /><i style={{ width: String(item.enrolled ? (item.inProgress / item.enrolled) * 100 : 0) + "%" }} /><i style={{ width: String(item.enrolled ? (item.notStarted / item.enrolled) * 100 : 0) + "%" }} /></div>
        <small>{item.completed} completed · {item.inProgress} in progress · {item.notStarted} not started</small>
      </div>)}</div>
      <p className="breakdown-footnote">Showing the six courses with the most enrollments.</p>
    </section>
    <section className="panel breakdown-panel">
      <div className="panel-header"><div><p className="eyebrow">Progress state</p><h2>Across all enrollments</h2></div><span className="breakdown-caption">{totalProgress} total</span></div>
      <div className="progress-breakdown-list">{dashboard.progressBreakdown.map((item) => <div className="progress-breakdown-row" key={item.progress}>
        <div><span className={"progress-dot progress-" + item.progress} /><strong>{labels[item.progress] ?? item.progress}</strong></div><strong>{item.count}</strong>
      </div>)}</div>
      <div className="progress-total-bar">{dashboard.progressBreakdown.map((item) => <i key={item.progress} className={"progress-" + item.progress} style={{ width: String(totalProgress ? (item.count / totalProgress) * 100 : 0) + "%" }} />)}</div>
      <p className="breakdown-footnote">A learner’s state is tracked separately for every enrolled course.</p>
    </section>
  </div>;
}
