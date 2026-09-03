"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Archive,
  CheckCircle2,
  Circle,
  Download,
  Edit3,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

type Lesson = { id: string; title: string; content: string; position: number };
type Learner = { id: string; full_name: string; email: string };
type Activity = { id: string; event: string; message: string | null; created_at: string; actor?: { full_name?: string } | { full_name?: string }[] };
type Course = { id: string; title: string; description: string; category: string; status: string; instructor?: string; lessons: Lesson[] };
type RosterEntry = {
  id: string;
  progress: string;
  enrolled_at: string;
  last_progress_at: string | null;
  learner: { id: string; full_name: string; email: string } | null;
  completedLessonIds: string[];
};
type EnrollmentRequest = {
  id: string;
  status: string;
  created_at: string;
  learner: { id: string; full_name: string; email: string } | null;
};
type Props = {
  course: Course;
  enrollment: { id: string; progress: string } | null;
  completedLessonIds: string[];
  viewerRole: "instructor" | "learner" | null;
  learners: Learner[];
  activities?: Activity[];
  demoMode?: boolean;
  viewerName?: string;
  roster?: RosterEntry[];
  pendingRequests?: EnrollmentRequest[];
  myRequestStatus?: string | null;
};

const backendEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function statusClass(status: string) {
  return `detail-status-badge status-${status}`;
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function CourseDetailClient({
  course: initialCourse,
  enrollment: initialEnrollment,
  completedLessonIds,
  viewerRole,
  learners,
  activities: initialActivities = [],
  demoMode = false,
  viewerName = "You",
  roster: initialRoster = [],
  pendingRequests: initialRequests = [],
  myRequestStatus: initialRequestStatus = null,
}: Props) {
  const router = useRouter();
  const [course, setCourse] = useState(initialCourse);
  const [enrollment, setEnrollment] = useState(initialEnrollment);
  const [completed, setCompleted] = useState<string[]>(completedLessonIds);
  const [activities, setActivities] = useState(initialActivities);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState(learners[0]?.id ?? "");
  const [enrolledLearner, setEnrolledLearner] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [showLessonEditor, setShowLessonEditor] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [showCourseEditor, setShowCourseEditor] = useState(false);
  const [requests, setRequests] = useState<EnrollmentRequest[]>(initialRequests);
  const [rosterEntries, setRosterEntries] = useState<RosterEntry[]>(initialRoster);
  const [myRequest, setMyRequest] = useState<string | null>(initialRequestStatus);
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);

  const isDemo = demoMode || !backendEnabled;
  const canEnroll = course.status === "published";
  const selectedRoster = rosterEntries.find((entry) => entry.id === selectedRosterId) ?? null;

  function showNotice(value: string) {
    setNotice(value);
    window.setTimeout(() => setNotice(""), 3200);
  }

  async function enrollLearner() {
    if (viewerRole === "instructor" && !selectedLearnerId) {
      showNotice("Choose a learner before enrolling.");
      return;
    }
    setPending("enroll");
    try {
      if (isDemo) {
        const learner = learners.find((item) => item.id === selectedLearnerId);
        setEnrolledLearner(learner ? `${learner.full_name} (${learner.email})` : "learner");
        showNotice("Learner enrolled in demo mode.");
        return;
      }
      const response = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, learnerId: selectedLearnerId }),
      });
      const result = await response.json();
      if (!response.ok) {
        showNotice(result.error ?? "Could not enroll");
        return;
      }
      const learner = learners.find((item) => item.id === selectedLearnerId);
      setEnrolledLearner(learner ? `${learner.full_name} (${learner.email})` : "learner");
      showNotice("Learner enrolled successfully.");
      router.refresh();
    } catch {
      showNotice("Network error. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function requestEnrollment() {
    setPending("enroll");
    try {
      if (isDemo) {
        setMyRequest("pending");
        showNotice("Enrollment requested in demo mode.");
        return;
      }
      const response = await fetch("/api/enrollments/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        showNotice(result.error ?? "Could not request enrollment");
        return;
      }
      setMyRequest("pending");
      showNotice("Request sent. The instructor will review it soon.");
      router.refresh();
    } catch {
      showNotice("Network error. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function decideRequest(requestId: string, decision: "approved" | "rejected") {
    setPending(requestId);
    try {
      if (isDemo) {
        setRequests((items) => items.filter((item) => item.id !== requestId));
        showNotice(decision === "approved" ? "Request approved in demo mode." : "Request declined in demo mode.");
        return;
      }
      const response = await fetch("/api/enrollments/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, decision }),
      });
      const result = await response.json();
      if (!response.ok) {
        showNotice(result.error ?? "Could not update request");
        return;
      }
      setRequests((items) => items.filter((item) => item.id !== requestId));
      showNotice(decision === "approved" ? "Learner enrolled." : "Request declined.");
      router.refresh();
    } catch {
      showNotice("Network error. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function complete(lessonId: string) {
    setPending(lessonId);
    try {
      if (isDemo) {
        const next = [...completed, lessonId];
        setCompleted(next);
        setEnrollment((current) =>
          current ? { ...current, progress: next.length === course.lessons.length ? "completed" : "in_progress" } : current,
        );
        showNotice(next.length === course.lessons.length ? "Course completed — congratulations!" : "Lesson marked complete in demo mode.");
        return;
      }
      const response = await fetch("/api/progress/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      const result = await response.json();
      if (!response.ok) {
        showNotice(result.error ?? "Could not update progress");
        return;
      }
      setCompleted((items) => (items.includes(lessonId) ? items : [...items, lessonId]));
      setEnrollment((current) => (current ? { ...current, progress: result.progress } : current));
      showNotice(result.progress === "completed" ? "Course completed — congratulations!" : "Lesson marked complete.");
    } catch {
      showNotice("Network error. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function completeForLearner(entry: RosterEntry, lessonId: string) {
    if (!entry.learner) return;
    setPending(`${entry.id}:${lessonId}`);
    try {
      const response = await fetch("/api/progress/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, learnerId: entry.learner.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        showNotice(result.error ?? "Could not update progress");
        return;
      }
      setRosterEntries((items) =>
        items.map((row) =>
          row.id === entry.id
            ? { ...row, progress: result.progress, completedLessonIds: [...row.completedLessonIds, lessonId] }
            : row,
        ),
      );
      showNotice(`Marked complete for ${entry.learner.full_name}.`);
      router.refresh();
    } catch {
      showNotice("Network error. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function completeAllForLearner(entry: RosterEntry) {
    if (!entry.learner) return;
    const remaining = course.lessons.filter((lesson) => !entry.completedLessonIds.includes(lesson.id));
    if (!remaining.length) {
      showNotice("All lessons are already complete.");
      return;
    }
    setPending(`${entry.id}:all`);
    try {
      for (const lesson of remaining) {
        const response = await fetch("/api/progress/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId: lesson.id, learnerId: entry.learner.id }),
        });
        const result = await response.json();
        if (!response.ok && result.code !== "ALREADY_COMPLETED") {
          showNotice(result.error ?? "Could not update progress");
          return;
        }
      }
      setRosterEntries((items) =>
        items.map((row) =>
          row.id === entry.id
            ? { ...row, progress: "completed", completedLessonIds: course.lessons.map((lesson) => lesson.id) }
            : row,
        ),
      );
      showNotice(`All lessons marked complete for ${entry.learner.full_name}.`);
      router.refresh();
    } catch {
      showNotice("Network error. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function saveCourse(input: { title: string; description: string; category: string }) {
    setPending("course");
    try {
      if (isDemo) {
        setCourse((current) => ({ ...current, ...input }));
        setShowCourseEditor(false);
        showNotice("Course details updated in demo mode.");
        return;
      }
      const response = await fetch(`/api/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update course");
      setCourse((current) => ({ ...current, ...result }));
      setShowCourseEditor(false);
      showNotice("Course details updated.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not update course");
    } finally {
      setPending(null);
    }
  }

  async function transition(action: "archive" | "restore" | "publish") {
    setPending(action);
    try {
      if (isDemo) {
        const status = action === "publish" ? "published" : action === "archive" ? "archived" : "published";
        if (action === "publish" && course.lessons.length === 0) {
          showNotice("Add at least one lesson before publishing this course.");
          return;
        }
        setCourse((current) => ({ ...current, status }));
        showNotice(`Course ${action === "restore" ? "restored" : `${action}ed`} in demo mode.`);
        return;
      }
      const response = await fetch(
        action === "publish" ? `/api/courses/${course.id}/publish` : `/api/courses/${course.id}/lifecycle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: action === "publish" ? undefined : JSON.stringify({ action }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        showNotice(result.error ?? "Could not change course state");
        return;
      }
      setCourse((current) => ({ ...current, status: result.status }));
      showNotice(`Course ${action === "restore" ? "restored" : `${action}ed`}.`);
    } catch {
      showNotice("Network error. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function saveLesson(input: { title: string; content: string }) {
    setPending("lesson");
    try {
      if (isDemo) {
        if (editingLesson) {
          setCourse((current) => ({
            ...current,
            lessons: current.lessons.map((lesson) => (lesson.id === editingLesson.id ? { ...lesson, ...input } : lesson)),
          }));
        } else {
          setCourse((current) => ({
            ...current,
            lessons: [...current.lessons, { ...input, id: `demo-lesson-${Date.now()}`, position: current.lessons.length + 1 }],
          }));
        }
        setEditingLesson(null);
        setShowLessonEditor(false);
        showNotice(editingLesson ? "Lesson updated in demo mode." : "Lesson added in demo mode.");
        return;
      }
      const response = await fetch(`/api/courses/${course.id}/lessons`, {
        method: editingLesson ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, ...(editingLesson ? { lessonId: editingLesson.id } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save lesson");
      setCourse((current) => ({
        ...current,
        lessons: editingLesson
          ? current.lessons.map((lesson) => (lesson.id === editingLesson.id ? result : lesson))
          : [...current.lessons, result],
      }));
      setEditingLesson(null);
      setShowLessonEditor(false);
      showNotice(editingLesson ? "Lesson updated." : "Lesson added.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not save lesson");
    } finally {
      setPending(null);
    }
  }

  async function removeLesson(lessonId: string) {
    if (!window.confirm("Remove this lesson? Learner completion records for it will also be removed.")) return;
    setPending(lessonId);
    try {
      if (isDemo) {
        setCourse((current) => ({
          ...current,
          lessons: current.lessons
            .filter((lesson) => lesson.id !== lessonId)
            .map((lesson, index) => ({ ...lesson, position: index + 1 })),
        }));
        showNotice("Lesson removed in demo mode.");
        return;
      }
      const response = await fetch(`/api/courses/${course.id}/lessons?lessonId=${encodeURIComponent(lessonId)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not remove lesson");
      setCourse((current) => ({
        ...current,
        lessons: current.lessons
          .filter((lesson) => lesson.id !== lessonId)
          .map((lesson, index) => ({ ...lesson, position: index + 1 })),
      }));
      setCompleted((items) => items.filter((id) => id !== lessonId));
      showNotice("Lesson removed.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not remove lesson");
    } finally {
      setPending(null);
    }
  }

  async function moveLesson(lessonId: string, direction: -1 | 1) {
    const index = course.lessons.findIndex((lesson) => lesson.id === lessonId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= course.lessons.length) return;
    const reordered = [...course.lessons];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const next = reordered.map((lesson, position) => ({ ...lesson, position: position + 1 }));
    setCourse((current) => ({ ...current, lessons: next }));
    if (isDemo) {
      showNotice("Lesson order updated in demo mode.");
      return;
    }
    const response = await fetch(`/api/courses/${course.id}/lessons/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonIds: next.map((lesson) => lesson.id) }),
    });
    if (!response.ok) showNotice("Could not save lesson order");
  }

  async function comment() {
    if (!message.trim()) return;
    setPending("comment");
    try {
      if (isDemo) {
        setActivities((items) => [
          { id: `demo-activity-${Date.now()}`, event: "commented", message: message.trim(), created_at: new Date().toISOString() },
          ...items,
        ]);
        setMessage("");
        showNotice("Comment added to the activity history.");
        return;
      }
      const response = await fetch(`/api/courses/${course.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not add comment");
      setActivities((items) => [{ ...result, actor: { full_name: viewerName } }, ...items]);
      setMessage("");
      showNotice("Comment added to the activity history.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not add comment");
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="detail-shell">
      <header className="detail-topbar">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> Back to workspace
        </Link>
        <span className="detail-logo">
          kinship<span>.</span>
        </span>
      </header>

      <div className="detail-wrap">
        <div className="detail-hero">
          <div>
            <span className="detail-category">{course.category}</span>
            <h1>{course.title}</h1>
            <p>{course.description}</p>
            <small>
              By {course.instructor ?? "Kinship instructor"} · {course.lessons.length} lessons
            </small>
          </div>

          <div className="detail-status">
            {viewerRole === "instructor" ? (
              <div className="course-actions">
                <div className="action-row">
                  <span className={statusClass(course.status)}>{course.status}</span>
                  <button className="icon-button subtle" aria-label="Edit course" onClick={() => setShowCourseEditor(true)}>
                    <Edit3 size={16} />
                  </button>
                </div>
                <div className="action-row">
                  {course.status === "draft" && (
                    <button className="button button-primary" onClick={() => transition("publish")} disabled={pending !== null}>
                      <CheckCircle2 size={15} /> Publish
                    </button>
                  )}
                  {course.status === "published" && (
                    <button className="button button-secondary" onClick={() => transition("archive")} disabled={pending !== null}>
                      <Archive size={15} /> Archive
                    </button>
                  )}
                  {course.status === "archived" && (
                    <button className="button button-primary" onClick={() => transition("restore")} disabled={pending !== null}>
                      <RotateCcw size={15} /> Restore
                    </button>
                  )}
                  {!isDemo && (
                    <a className="button button-secondary" href={`/api/export/${course.id}`}>
                      <Download size={15} /> Export progress CSV
                    </a>
                  )}
                </div>
              </div>
            ) : enrollment ? (
              <>
                <strong>{enrollment.progress.replaceAll("_", " ")}</strong>
                <span>Your progress</span>
              </>
            ) : (
              <LearnerEnrollmentCta
                status={course.status}
                requestStatus={myRequest}
                busy={pending !== null}
                requesting={pending === "enroll"}
                onRequest={requestEnrollment}
              />
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
                <span className="lesson-count">
                  {completed.length}/{course.lessons.length} complete
                </span>
                {viewerRole === "instructor" && (
                  <button
                    className="button button-secondary"
                    onClick={() => {
                      setEditingLesson(null);
                      setShowLessonEditor(true);
                    }}
                  >
                    <Plus size={15} /> Add lesson
                  </button>
                )}
              </div>
            </div>

            <div className="lesson-list">
              {course.lessons.map((lesson, index) => (
                <article className="lesson-card" key={lesson.id}>
                  <div className="lesson-number">
                    {completed.includes(lesson.id) ? <CheckCircle2 size={19} /> : <Circle size={19} />}
                  </div>
                  <div className="lesson-copy">
                    <span>Lesson {lesson.position}</span>
                    <h3>{lesson.title}</h3>
                    <p>{lesson.content}</p>
                  </div>
                  {viewerRole === "learner" && enrollment && !completed.includes(lesson.id) && (
                    <button
                      className="button button-secondary lesson-action"
                      onClick={() => complete(lesson.id)}
                      disabled={pending === lesson.id}
                    >
                      {pending === lesson.id ? <Loader2 size={14} className="spin" /> : "Complete"}
                    </button>
                  )}
                  {viewerRole === "instructor" && (
                    <div className="lesson-management">
                      <button
                        className="icon-button subtle"
                        aria-label={`Move ${lesson.title} up`}
                        onClick={() => moveLesson(lesson.id, -1)}
                        disabled={index === 0}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        className="icon-button subtle"
                        aria-label={`Move ${lesson.title} down`}
                        onClick={() => moveLesson(lesson.id, 1)}
                        disabled={index === course.lessons.length - 1}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        className="icon-button subtle"
                        aria-label={`Edit ${lesson.title}`}
                        onClick={() => {
                          setEditingLesson(lesson);
                          setShowLessonEditor(true);
                        }}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        className="icon-button subtle danger"
                        aria-label={`Remove ${lesson.title}`}
                        onClick={() => removeLesson(lesson.id)}
                        disabled={pending === lesson.id}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>

            {course.lessons.length === 0 && (
              <div className="empty-lessons">
                <p>No lessons yet.</p>
                <button className="button button-primary" onClick={() => setShowLessonEditor(true)}>
                  <Plus size={15} /> Add the first lesson
                </button>
              </div>
            )}
          </section>

          <aside className="comment-panel">
            {viewerRole === "instructor" && (
              <>
                <section className="request-panel">
                  <div className="panel-heading">
                    <p className="eyebrow">Pending approval</p>
                    <h2>
                      Enrollment requests <span className="count-pill">{requests.length}</span>
                    </h2>
                  </div>
                  {requests.length === 0 ? (
                    <p className="panel-caption">No pending requests. New learner requests will appear here.</p>
                  ) : (
                    <div className="request-list">
                      {requests.map((item) => (
                        <div className="request-row" key={item.id}>
                          <span className="avatar avatar-lavender">{initialsFor(item.learner?.full_name ?? "?")}</span>
                          <div className="request-copy">
                            <strong>{item.learner?.full_name ?? "Learner"}</strong>
                            <span>{item.learner?.email ?? ""}</span>
                            <small>Requested {new Date(item.created_at).toLocaleDateString()}</small>
                          </div>
                          <div className="request-actions">
                            <button
                              className="button button-primary request-approve"
                              onClick={() => decideRequest(item.id, "approved")}
                              disabled={pending === item.id}
                            >
                              {pending === item.id ? <Loader2 size={14} className="spin" /> : "Accept"}
                            </button>
                            <button
                              className="button button-secondary request-decline"
                              onClick={() => decideRequest(item.id, "rejected")}
                              disabled={pending === item.id}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="roster-panel">
                  <div className="panel-heading">
                    <p className="eyebrow">Enrolled learners</p>
                    <h2>
                      Roster <span className="count-pill soft">{rosterEntries.length}</span>
                    </h2>
                  </div>
                  {rosterEntries.length === 0 ? (
                    <p className="panel-caption">No learners enrolled yet. Approve a request or enroll someone directly.</p>
                  ) : (
                    <div className="roster-list">
                      {rosterEntries.map((entry) => (
                        <button className="roster-row" key={entry.id} onClick={() => setSelectedRosterId(entry.id)}>
                          <span className="avatar avatar-mint">{initialsFor(entry.learner?.full_name ?? "?")}</span>
                          <span className="roster-copy">
                            <strong>{entry.learner?.full_name ?? "Learner"}</strong>
                            <span>{entry.learner?.email ?? ""}</span>
                          </span>
                          <span className="roster-meta">
                            <span className={`badge badge-${entry.progress.replaceAll("_", "-")}`}>
                              {entry.progress.replaceAll("_", " ")}
                            </span>
                            <small>
                              {entry.completedLessonIds.length}/{course.lessons.length} lessons
                            </small>
                            <small>
                              {entry.last_progress_at
                                ? `Active ${new Date(entry.last_progress_at).toLocaleDateString()}`
                                : "Not started"}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <div className="instructor-enroll-box">
                  <span className="status-label">
                    <UserPlus size={15} /> Enroll a learner
                  </span>
                  <select
                    aria-label="Learner to enroll"
                    value={selectedLearnerId}
                    onChange={(event) => setSelectedLearnerId(event.target.value)}
                    disabled={!canEnroll || pending !== null || learners.length === 0}
                  >
                    {learners.length === 0 ? (
                      <option value="">No learners found</option>
                    ) : (
                      learners.map((learner) => (
                        <option key={learner.id} value={learner.id}>
                          {learner.full_name} · {learner.email}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    className="button button-primary"
                    onClick={enrollLearner}
                    disabled={!canEnroll || pending !== null || learners.length === 0}
                  >
                    {pending === "enroll" ? (
                      <>
                        <Loader2 size={15} className="spin" /> Enrolling…
                      </>
                    ) : (
                      <>
                        <UserPlus size={15} /> Enroll learner
                      </>
                    )}
                  </button>
                  {!canEnroll && <small className="status-hint">Publish this course before enrolling learners.</small>}
                  {enrolledLearner && <small className="status-success">✓ {enrolledLearner}</small>}
                </div>
              </>
            )}

            <div className="notes-heading">
              <p className="eyebrow">Keep the conversation going</p>
              <h2>
                <MessageSquare size={17} /> Notes
              </h2>
            </div>
            <p className="panel-caption">Share a reflection or question with the instructor.</p>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What stood out to you?"
              rows={5}
            />
            <button
              className="button button-primary"
              onClick={comment}
              disabled={!message.trim() || pending === "comment"}
            >
              {pending === "comment" ? (
                <>
                  <Loader2 size={15} className="spin" /> Adding…
                </>
              ) : (
                <>
                  <Send size={15} /> Add comment
                </>
              )}
            </button>
          </aside>
        </div>

        <section className="detail-activity">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Immutable history</p>
              <h2>Course activity</h2>
            </div>
            <span className="activity-lock">Append-only</span>
          </div>
          <div className="detail-activity-list">
            {activities.length ? (
              activities.slice(0, 8).map((item) => {
                const actor = Array.isArray(item.actor) ? item.actor[0] : item.actor;
                return (
                  <div className="detail-activity-row" key={item.id}>
                    <span className="activity-event-dot" />
                    <div>
                      <strong>{item.event.replaceAll("_", " ")}</strong>
                      <p>{item.message ?? "Course activity recorded."}</p>
                      <small>
                        By {actor?.full_name ?? "System"} · {new Date(item.created_at).toLocaleString()}
                      </small>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="panel-caption">No activity recorded yet.</p>
            )}
          </div>
        </section>

        {notice && (
          <div className="detail-notice" role="status">
            <CheckCircle2 size={16} />
            {notice}
          </div>
        )}
      </div>

      {selectedRoster && (
        <RosterProgressModal
          entry={selectedRoster}
          lessons={course.lessons}
          busyKey={pending}
          onClose={() => setSelectedRosterId(null)}
          onComplete={(lessonId) => completeForLearner(selectedRoster, lessonId)}
          onCompleteAll={() => completeAllForLearner(selectedRoster)}
        />
      )}
      {showCourseEditor && (
        <CourseEditor course={course} onClose={() => setShowCourseEditor(false)} onSave={saveCourse} saving={pending === "course"} />
      )}
      {showLessonEditor && (
        <LessonEditor
          lesson={editingLesson}
          onClose={() => {
            setShowLessonEditor(false);
            setEditingLesson(null);
          }}
          onSave={saveLesson}
          saving={pending === "lesson"}
        />
      )}
    </main>
  );
}

function LearnerEnrollmentCta({
  status,
  requestStatus,
  busy,
  requesting,
  onRequest,
}: {
  status: string;
  requestStatus: string | null;
  busy: boolean;
  requesting: boolean;
  onRequest: () => void;
}) {
  if (status !== "published") {
    return (
      <>
        <strong>{status}</strong>
        <span>Not open for enrollment</span>
      </>
    );
  }
  if (requestStatus === "pending") {
    return (
      <>
        <strong>Request pending</strong>
        <span>The instructor will review your request soon</span>
        <button className="button button-secondary" disabled>
          Request pending
        </button>
      </>
    );
  }
  if (requestStatus === "rejected") {
    return (
      <>
        <strong>Request declined</strong>
        <span>You can send another request to the instructor</span>
        <button className="button button-primary" onClick={onRequest} disabled={busy}>
          {requesting ? (
            <>
              <Loader2 size={15} className="spin" /> Sending…
            </>
          ) : (
            "Request again"
          )}
        </button>
      </>
    );
  }
  return (
    <button className="button button-primary" onClick={onRequest} disabled={busy}>
      {requesting ? (
        <>
          <Loader2 size={15} className="spin" /> Sending…
        </>
      ) : (
        "Request to enroll"
      )}
    </button>
  );
}

function RosterProgressModal({
  entry,
  lessons,
  busyKey,
  onClose,
  onComplete,
  onCompleteAll,
}: {
  entry: RosterEntry;
  lessons: Lesson[];
  busyKey: string | null;
  onClose: () => void;
  onComplete: (lessonId: string) => void;
  onCompleteAll: () => void;
}) {
  const remaining = lessons.filter((lesson) => !entry.completedLessonIds.includes(lesson.id));
  return (
    <div className="modal-backdrop">
      <div className="modal roster-modal" role="dialog" aria-modal="true" aria-labelledby="roster-progress-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Learner progress</p>
            <h2 id="roster-progress-title">{entry.learner?.full_name ?? "Learner"}</h2>
          </div>
          <button className="icon-button subtle" aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="modal-copy">
          {entry.learner?.email ?? ""} · {entry.completedLessonIds.length}/{lessons.length} lessons ·{" "}
          {entry.progress.replaceAll("_", " ")}
        </p>
        <div className="roster-modal-actions">
          <button className="button button-secondary" onClick={onCompleteAll} disabled={!remaining.length || busyKey === `${entry.id}:all`}>
            {busyKey === `${entry.id}:all` ? (
              <>
                <Loader2 size={15} className="spin" /> Marking…
              </>
            ) : (
              "Mark all complete"
            )}
          </button>
        </div>
        <div className="roster-lesson-list">
          {lessons.map((lesson) => {
            const done = entry.completedLessonIds.includes(lesson.id);
            const busy = busyKey === `${entry.id}:${lesson.id}`;
            return (
              <div className="roster-lesson-row" key={lesson.id}>
                <div>
                  <strong>{lesson.title}</strong>
                  <small>Lesson {lesson.position}</small>
                </div>
                {done ? (
                  <span className="badge badge-completed">Completed</span>
                ) : (
                  <button className="button button-secondary" onClick={() => onComplete(lesson.id)} disabled={busy}>
                    {busy ? <Loader2 size={14} className="spin" /> : "Mark complete"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {lessons.length === 0 && <p className="panel-caption">This course has no lessons yet.</p>}
        <div className="modal-actions">
          <button className="button button-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseEditor({
  course,
  onClose,
  onSave,
  saving,
}: {
  course: Course;
  onClose: () => void;
  onSave: (input: { title: string; description: string; category: string }) => Promise<void>;
  saving: boolean;
}) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [category, setCategory] = useState(course.category);
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-course-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Course builder</p>
            <h2 id="edit-course-title">Edit course</h2>
          </div>
          <button className="icon-button subtle" aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <label>
          Course title
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          Description
          <textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>Compliance</option>
            <option>Leadership</option>
            <option>Skills</option>
            <option>People</option>
            <option>Product</option>
            <option>Operations</option>
            <option>Communication</option>
          </select>
        </label>
        <div className="modal-actions">
          <button className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={!title.trim() || saving}
            onClick={() => onSave({ title: title.trim(), description: description.trim(), category })}
          >
            {saving ? (
              <>
                <Loader2 size={15} className="spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonEditor({
  lesson,
  onClose,
  onSave,
  saving,
}: {
  lesson: Lesson | null;
  onClose: () => void;
  onSave: (input: { title: string; content: string }) => Promise<void>;
  saving: boolean;
}) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [content, setContent] = useState(lesson?.content ?? "");
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lesson-editor-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Lesson builder</p>
            <h2 id="lesson-editor-title">{lesson ? "Edit lesson" : "Add lesson"}</h2>
          </div>
          <button className="icon-button subtle" aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="modal-copy">Every lesson has a title, description, and position in the course path.</p>
        <label>
          Lesson title
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Practice in context" />
        </label>
        <label>
          Content or description
          <textarea
            rows={5}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="What should learners take away?"
          />
        </label>
        <div className="modal-actions">
          <button className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={!title.trim() || saving}
            onClick={() => onSave({ title: title.trim(), content: content.trim() })}
          >
            {saving ? (
              <>
                <Loader2 size={15} className="spin" /> Saving…
              </>
            ) : (
              "Save lesson"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
