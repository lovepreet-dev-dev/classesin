"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Archive, CheckCircle2, Circle, Download, Edit3, Loader2, MessageSquare, Plus, RotateCcw, Send, Trash2, Upload, UserPlus, X } from "lucide-react";

type Lesson = { id: string; title: string; content: string; position: number };
type Learner = { id: string; full_name: string; email: string };
type Activity = { id: string; event: string; message: string | null; created_at: string; actor?: { full_name?: string } | { full_name?: string }[] };
type RosterEntry = { id: string; fullName: string; email: string; progress: string; completedLessons: number };
type BulkResult = { email: string; status: "unknown" | "already_enrolled" | "newly_enrolled" | "error" };
type Course = { id: string; title: string; description: string; category: string; status: string; instructor?: string; lessons: Lesson[] };
type Props = { course: Course; enrollment: { id: string; progress: string } | null; completedLessonIds: string[]; viewerRole: "instructor" | "learner" | null; learners: Learner[]; roster?: RosterEntry[]; activities?: Activity[]; viewerName?: string };

function statusClass(status: string) { return `detail-status-badge status-${status}`; }

function initialsFor(fullName: string) {
  return fullName.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

const AVATAR_TONES = ["coral", "lavender", "mint", "yellow", "blue"] as const;

function avatarTone(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash + char.charCodeAt(0)) % AVATAR_TONES.length;
  return AVATAR_TONES[hash];
}

export default function CourseDetailClient({ course: initialCourse, enrollment: initialEnrollment, completedLessonIds, viewerRole, learners, roster: initialRoster = [], activities: initialActivities = [], viewerName = "You" }: Props) {
  const router = useRouter();
  const [course, setCourse] = useState(initialCourse);
  const [enrollment, setEnrollment] = useState(initialEnrollment);
  const [completed, setCompleted] = useState<string[]>(completedLessonIds);
  const [roster, setRoster] = useState<RosterEntry[]>(initialRoster);
  const [activities, setActivities] = useState(initialActivities);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState(learners[0]?.id ?? "");
  const [enrolledLearner, setEnrolledLearner] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [showLessonEditor, setShowLessonEditor] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [showCourseEditor, setShowCourseEditor] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [syncedRoster, setSyncedRoster] = useState(initialRoster);
  if (initialRoster !== syncedRoster) { setSyncedRoster(initialRoster); setRoster(initialRoster); }

  const canEnroll = course.status === "published";
  const lessonTotal = course.lessons.length;
  const progressPercent = lessonTotal ? Math.round((completed.length / lessonTotal) * 100) : 0;

  function showNotice(value: string) { setNotice(value); window.setTimeout(() => setNotice(""), 3200); }

  async function enroll() {
    if (viewerRole === "instructor" && !selectedLearnerId) { showNotice("Choose a learner before enrolling."); return; }
    setPending("enroll");
    try {
      const body = { courseId: course.id, ...(viewerRole === "instructor" ? { learnerId: selectedLearnerId } : {}) };
      const response = await fetch("/api/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) { showNotice(result.error ?? "Could not enroll"); return; }
      if (viewerRole === "instructor") {
        const learner = learners.find((item) => item.id === selectedLearnerId);
        setEnrolledLearner(learner ? `${learner.full_name} (${learner.email})` : "learner");
        if (learner) setRoster((entries) => entries.some((entry) => entry.email === learner.email) ? entries : [{ id: result.id, fullName: learner.full_name, email: learner.email, progress: "not_started", completedLessons: 0 }, ...entries]);
        showNotice("Learner enrolled successfully.");
      } else {
        setEnrollment({ id: result.id, progress: "not_started" });
        showNotice("You’re enrolled. Start with the first lesson.");
      }
    } catch { showNotice("Network error. Please try again."); } finally { setPending(null); }
  }

  async function complete(lessonId: string) {
    setPending(lessonId);
    try {
      const response = await fetch("/api/progress/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId }) });
      const result = await response.json();
      if (!response.ok) { showNotice(result.error ?? "Could not update progress"); return; }
      setCompleted((items) => items.includes(lessonId) ? items : [...items, lessonId]);
      setEnrollment((current) => current ? { ...current, progress: result.progress } : current);
      showNotice(result.progress === "completed" ? "Course completed — congratulations!" : "Lesson marked complete.");
    } catch { showNotice("Network error. Please try again."); } finally { setPending(null); }
  }

  async function saveCourse(input: { title: string; description: string; category: string }) {
    setPending("course");
    try {
      const response = await fetch(`/api/courses/${course.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update course");
      setCourse((current) => ({ ...current, ...result }));
      setShowCourseEditor(false);
      showNotice("Course details updated.");
    } catch (error) { showNotice(error instanceof Error ? error.message : "Could not update course"); } finally { setPending(null); }
  }

  async function transition(action: "archive" | "restore" | "publish") {
    setPending(action);
    try {
      const response = await fetch(action === "publish" ? `/api/courses/${course.id}/publish` : `/api/courses/${course.id}/lifecycle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: action === "publish" ? undefined : JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok) { showNotice(result.error ?? "Could not change course state"); return; }
      setCourse((current) => ({ ...current, status: result.status }));
      showNotice(`Course ${action === "restore" ? "restored" : `${action}ed`}.`);
    } catch { showNotice("Network error. Please try again."); } finally { setPending(null); }
  }

  async function saveLesson(input: { title: string; content: string }) {
    setPending("lesson");
    try {
      const response = await fetch(`/api/courses/${course.id}/lessons`, { method: editingLesson ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, ...(editingLesson ? { lessonId: editingLesson.id } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save lesson");
      setCourse((current) => ({ ...current, lessons: editingLesson ? current.lessons.map((lesson) => lesson.id === editingLesson.id ? result : lesson) : [...current.lessons, result] }));
      setEditingLesson(null);
      setShowLessonEditor(false);
      showNotice(editingLesson ? "Lesson updated." : "Lesson added.");
    } catch (error) { showNotice(error instanceof Error ? error.message : "Could not save lesson"); } finally { setPending(null); }
  }

  async function removeLesson(lessonId: string) {
    if (!window.confirm("Remove this lesson? Learner completion records for it will also be removed.")) return;
    setPending(lessonId);
    try {
      const response = await fetch(`/api/courses/${course.id}/lessons?lessonId=${encodeURIComponent(lessonId)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not remove lesson");
      setCourse((current) => ({ ...current, lessons: current.lessons.filter((lesson) => lesson.id !== lessonId).map((lesson, index) => ({ ...lesson, position: index + 1 })) }));
      setCompleted((items) => items.filter((id) => id !== lessonId));
      showNotice("Lesson removed.");
    } catch (error) { showNotice(error instanceof Error ? error.message : "Could not remove lesson"); } finally { setPending(null); }
  }

  async function moveLesson(lessonId: string, direction: -1 | 1) {
    const index = course.lessons.findIndex((lesson) => lesson.id === lessonId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= course.lessons.length) return;
    const reordered = [...course.lessons];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const next = reordered.map((lesson, position) => ({ ...lesson, position: position + 1 }));
    setCourse((current) => ({ ...current, lessons: next }));
    const response = await fetch(`/api/courses/${course.id}/lessons/reorder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonIds: next.map((lesson) => lesson.id) }) });
    if (!response.ok) showNotice("Could not save lesson order");
  }

  async function comment() {
    if (!message.trim()) return;
    setPending("comment");
    try {
      const response = await fetch(`/api/courses/${course.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not add comment");
      setActivities((items) => [{ ...result, actor: { full_name: viewerName } }, ...items]);
      setMessage("");
      showNotice("Comment added to the activity history.");
    } catch (error) { showNotice(error instanceof Error ? error.message : "Could not add comment"); } finally { setPending(null); }
  }

  function handleBulkEnrolled(results: BulkResult[]) {
    const newly = results.filter((row) => row.status === "newly_enrolled");
    if (newly.length) router.refresh();
    showNotice(`${newly.length} of ${results.length} addresses enrolled`);
  }

  return (
    <main className="detail-shell">
      <header className="detail-topbar">
        <Link href="/" className="back-link"><ArrowLeft size={16} /> Back to workspace</Link>
        <span className="detail-logo">kinship<span>.</span></span>
      </header>
      <div className="detail-wrap">
        <div className="detail-hero">
          <div>
            <span className="detail-category">{course.category}</span>
            <h1>{course.title}</h1>
            <p>{course.description}</p>
            <small>By {course.instructor ?? "Kinship instructor"} · {course.lessons.length} lessons</small>
          </div>
          <div className="detail-status">
            {viewerRole === "instructor" ? (
              <div className="course-actions">
                <div className="action-row">
                  <span className={statusClass(course.status)}>{course.status}</span>
                  <button className="icon-button subtle" aria-label="Edit course" onClick={() => setShowCourseEditor(true)}><Edit3 size={16} /></button>
                </div>
                <div className="action-row">
                  {course.status === "draft" && <button className="button button-primary" onClick={() => transition("publish")} disabled={pending !== null}><CheckCircle2 size={15} /> Publish</button>}
                  {course.status === "published" && <button className="button button-secondary" onClick={() => transition("archive")} disabled={pending !== null}><Archive size={15} /> Archive</button>}
                  {course.status === "archived" && <button className="button button-primary" onClick={() => transition("restore")} disabled={pending !== null}><RotateCcw size={15} /> Restore</button>}
                  <a className="button button-secondary" href={`/api/export/${course.id}`}><Download size={15} /> Export progress CSV</a>
                </div>
              </div>
            ) : enrollment ? (
              <div className="detail-progress">
                <strong>{enrollment.progress.replaceAll("_", " ")}</strong>
                <div className="progress-track"><i className="progress-fill fill-mint" style={{ width: `${progressPercent}%` }} /></div>
                <span>{completed.length} of {lessonTotal} lessons complete</span>
              </div>
            ) : canEnroll ? (
              <button className="button button-primary" onClick={enroll} disabled={pending !== null}>
                {pending === "enroll" ? <><Loader2 size={15} className="spin" /> Enrolling…</> : "Enroll in course"}
              </button>
            ) : (
              <><strong>{course.status}</strong><span>Not open for enrollment</span></>
            )}
          </div>
        </div>
        <div className="detail-grid">
          <section className="lesson-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Course path</p>
                <h2>Lessons</h2>
              </div>
              <div className="lesson-header-actions">
                <span className="lesson-count">{completed.length}/{course.lessons.length} complete</span>
                {viewerRole === "instructor" && <button className="button button-secondary" onClick={() => { setEditingLesson(null); setShowLessonEditor(true); }}><Plus size={15} /> Add lesson</button>}
              </div>
            </div>
            <div className="lesson-list">
              {course.lessons.map((lesson, index) => (
                <article className={`lesson-card${completed.includes(lesson.id) ? " done" : ""}`} key={lesson.id}>
                  <div className="lesson-number">{completed.includes(lesson.id) ? <CheckCircle2 size={19} /> : <Circle size={19} />}</div>
                  <div className="lesson-copy">
                    <span>Lesson {lesson.position}</span>
                    <h3>{lesson.title}</h3>
                    <p>{lesson.content}</p>
                  </div>
                  {viewerRole === "learner" && enrollment && !completed.includes(lesson.id) && (
                    <button className="button button-secondary lesson-action" onClick={() => complete(lesson.id)} disabled={pending === lesson.id}>
                      {pending === lesson.id ? <Loader2 size={14} className="spin" /> : "Complete"}
                    </button>
                  )}
                  {viewerRole === "learner" && enrollment && completed.includes(lesson.id) && <span className="badge badge-completed lesson-action">Completed</span>}
                  {viewerRole === "instructor" && (
                    <div className="lesson-management">
                      <button className="icon-button subtle" aria-label={`Move ${lesson.title} up`} onClick={() => moveLesson(lesson.id, -1)} disabled={index === 0}><ArrowUp size={14} /></button>
                      <button className="icon-button subtle" aria-label={`Move ${lesson.title} down`} onClick={() => moveLesson(lesson.id, 1)} disabled={index === course.lessons.length - 1}><ArrowDown size={14} /></button>
                      <button className="icon-button subtle" aria-label={`Edit ${lesson.title}`} onClick={() => { setEditingLesson(lesson); setShowLessonEditor(true); }}><Edit3 size={14} /></button>
                      <button className="icon-button subtle danger" aria-label={`Remove ${lesson.title}`} onClick={() => removeLesson(lesson.id)} disabled={pending === lesson.id}><Trash2 size={14} /></button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            {course.lessons.length === 0 && (
              <div className="empty-lessons">
                <p>No lessons yet.</p>
                <button className="button button-primary" onClick={() => setShowLessonEditor(true)}><Plus size={15} /> Add the first lesson</button>
              </div>
            )}
          </section>
          <aside className="comment-panel">
            {viewerRole === "instructor" && (
              <div className="instructor-enroll-box">
                <span className="status-label"><UserPlus size={15} /> Enroll a learner</span>
                <select aria-label="Learner to enroll" value={selectedLearnerId} onChange={(event) => setSelectedLearnerId(event.target.value)} disabled={!canEnroll || pending !== null || learners.length === 0}>
                  {learners.length === 0 ? <option value="">No learners found</option> : learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.full_name} · {learner.email}</option>)}
                </select>
                <button className="button button-primary" onClick={enroll} disabled={!canEnroll || pending !== null || learners.length === 0}>
                  {pending === "enroll" ? <><Loader2 size={15} className="spin" /> Enrolling…</> : <><UserPlus size={15} /> Enroll learner</>}
                </button>
                <button className="button button-secondary" onClick={() => setShowBulk(true)} disabled={!canEnroll}><Upload size={15} /> Bulk enroll</button>
                {!canEnroll && <small className="status-hint">Publish this course before enrolling learners.</small>}
                {enrolledLearner && <small className="status-success">✓ {enrolledLearner}</small>}
              </div>
            )}
            <div className="notes-heading">
              <p className="eyebrow">Keep the conversation going</p>
              <h2><MessageSquare size={17} /> Notes</h2>
            </div>
            <p className="panel-caption">Share a reflection or question with the instructor.</p>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What stood out to you?" rows={5} />
            <button className="button button-primary" onClick={comment} disabled={!message.trim() || pending === "comment"}>
              {pending === "comment" ? <><Loader2 size={15} className="spin" /> Adding…</> : <><Send size={15} /> Add comment</>}
            </button>
          </aside>
        </div>
        {viewerRole === "instructor" && (
          <section className="detail-roster">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Class roster</p>
                <h2>Enrolled learners</h2>
              </div>
              <span className="count-pill soft">{roster.length}</span>
            </div>
            {roster.length ? (
              <div className="roster-list">
                {roster.map((entry) => (
                  <div className="roster-row" key={entry.id}>
                    <span className={`avatar avatar-${avatarTone(entry.id)}`}>{initialsFor(entry.fullName)}</span>
                    <div className="roster-person">
                      <strong>{entry.fullName}</strong>
                      <small>{entry.email}</small>
                    </div>
                    <div className="roster-progress">
                      <span className={`badge badge-${entry.progress.replaceAll("_", "-")}`}>{entry.progress.replaceAll("_", " ")}</span>
                      <small>{entry.completedLessons} of {lessonTotal} lessons</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-caption">No one is enrolled yet. Enroll a learner above or run a bulk enrollment from the workspace.</p>
            )}
          </section>
        )}
        <section className="detail-activity">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Immutable history</p>
              <h2>Course activity</h2>
            </div>
            <span className="activity-lock">Append-only</span>
          </div>
          <div className="detail-activity-list">
            {activities.length ? activities.slice(0, 8).map((item) => {
              const actor = Array.isArray(item.actor) ? item.actor[0] : item.actor;
              return (
                <div className="detail-activity-row" key={item.id}>
                  <span className="activity-event-dot" />
                  <div>
                    <strong>{item.event.replaceAll("_", " ")}</strong>
                    <p>{item.message ?? "Course activity recorded."}</p>
                    <small>By {actor?.full_name ?? "System"} · {new Date(item.created_at).toLocaleString()}</small>
                  </div>
                </div>
              );
            }) : <p className="panel-caption">No activity recorded yet.</p>}
          </div>
        </section>
        {notice && <div className="detail-notice" role="status"><CheckCircle2 size={16} />{notice}</div>}
      </div>
      {showCourseEditor && <CourseEditor course={course} onClose={() => setShowCourseEditor(false)} onSave={saveCourse} saving={pending === "course"} />}
      {showLessonEditor && <LessonEditor lesson={editingLesson} onClose={() => { setShowLessonEditor(false); setEditingLesson(null); }} onSave={saveLesson} saving={pending === "lesson"} />}
      {showBulk && <BulkEnrollModal courseId={course.id} onClose={() => setShowBulk(false)} onEnrolled={handleBulkEnrolled} />}
    </main>
  );
}

function CourseEditor({ course, onClose, onSave, saving }: { course: Course; onClose: () => void; onSave: (input: { title: string; description: string; category: string }) => Promise<void>; saving: boolean }) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [category, setCategory] = useState(course.category);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-course-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Course builder</p>
            <h2 id="edit-course-title">Edit course</h2>
          </div>
          <button className="icon-button subtle" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        <label>Course title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Description<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Compliance</option><option>Leadership</option><option>Skills</option><option>People</option><option>Product</option><option>Operations</option><option>Communication</option></select></label>
        <div className="modal-actions">
          <button className="button button-secondary" onClick={onClose}>Cancel</button>
          <button className="button button-primary" disabled={!title.trim() || saving} onClick={() => onSave({ title: title.trim(), description: description.trim(), category })}>
            {saving ? <><Loader2 size={15} className="spin" /> Saving…</> : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonEditor({ lesson, onClose, onSave, saving }: { lesson: Lesson | null; onClose: () => void; onSave: (input: { title: string; content: string }) => Promise<void>; saving: boolean }) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [content, setContent] = useState(lesson?.content ?? "");
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lesson-editor-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Lesson builder</p>
            <h2 id="lesson-editor-title">{lesson ? "Edit lesson" : "Add lesson"}</h2>
          </div>
          <button className="icon-button subtle" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="modal-copy">Every lesson has a title, description, and position in the course path.</p>
        <label>Lesson title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Practice in context" /></label>
        <label>Content or description<textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} placeholder="What should learners take away?" /></label>
        <div className="modal-actions">
          <button className="button button-secondary" onClick={onClose}>Cancel</button>
          <button className="button button-primary" disabled={!title.trim() || saving} onClick={() => onSave({ title: title.trim(), content: content.trim() })}>
            {saving ? <><Loader2 size={15} className="spin" /> Saving…</> : "Save lesson"}
          </button>
        </div>
      </div>
    </div>
  );
}

const bulkStatusLabels: Record<BulkResult["status"], string> = { newly_enrolled: "Newly enrolled", already_enrolled: "Already enrolled", unknown: "Unknown address", error: "Could not process" };
const bulkStatusBadge: Record<BulkResult["status"], string> = { newly_enrolled: "badge-completed", already_enrolled: "badge-draft", unknown: "badge-archived", error: "badge-in-progress" };

function BulkEnrollModal({ courseId, onClose, onEnrolled }: { courseId: string; onClose: () => void; onEnrolled: (results: BulkResult[]) => void }) {
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
      const response = await fetch("/api/enrollments/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, emails: [...new Set(emails.split(/[\n,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))] }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not enroll learners");
      const list = (result.results ?? []) as BulkResult[];
      setResults(list);
      onEnrolled(list);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not enroll learners"); } finally { setSaving(false); }
  }
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal bulk-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-enroll-title" onClick={(event) => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">Enrollment tools</p><h2 id="bulk-enroll-title">Bulk enroll learners</h2></div><button className="icon-button subtle" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
      {results ? <>
        <p className="modal-copy">Each address has been checked. Unregistered addresses are reported as unknown — they need an account before they can be enrolled.</p>
        <div className="bulk-summary">
          <strong>{results.filter((row) => row.status === "newly_enrolled").length} newly enrolled</strong>
          <span>{results.filter((row) => row.status === "already_enrolled").length} already enrolled</span>
          <span>{results.filter((row) => row.status === "unknown").length} unknown</span>
        </div>
        <div className="bulk-results">{results.map((row) => <div key={row.email}><span>{row.email}</span><span className={`badge ${bulkStatusBadge[row.status]}`}>{bulkStatusLabels[row.status]}</span></div>)}</div>
        <div className="modal-actions"><button className="button button-primary" onClick={onClose}>Done</button></div>
      </> : <>
        <p className="modal-copy">Paste one email per line or upload a CSV. Only registered learner accounts can be enrolled — anything else is reported as unknown, never silently created.</p>
        <label>Email addresses<textarea value={emails} onChange={(event) => setEmails(event.target.value)} placeholder={"learner@northstar.co\nnew.learner@northstar.co"} rows={5} /></label>
        <label className="upload-drop"><Upload size={18} /><span><strong>Upload CSV</strong><small>one address per row — the first column is used</small></span><input type="file" accept=".csv,text/csv" onChange={importCsv} /></label>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button className="button button-secondary" onClick={onClose}>Cancel</button>
          <button className="button button-primary" disabled={!emails.trim() || saving} onClick={save}>{saving ? <><Loader2 size={15} className="spin" /> Reviewing…</> : <><Upload size={15} /> Review enrollments</>}</button>
        </div>
      </>}
    </div>
  </div>;
}
