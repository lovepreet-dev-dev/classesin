"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Loader2, MessageSquare, Send, UserPlus } from "lucide-react";

type Learner = { id: string; full_name: string; email: string };
type Props = {
  course: { id: string; title: string; description: string; category: string; status: string; instructor?: string; lessons: { id: string; title: string; content: string; position: number }[] };
  enrollment: { id: string; progress: string } | null;
  completedLessonIds: string[];
  viewerRole: "instructor" | "learner" | null;
  learners: Learner[];
};

export default function CourseDetailClient({ course, enrollment: initialEnrollment, completedLessonIds, viewerRole, learners }: Props) {
  const [enrollment, setEnrollment] = useState(initialEnrollment);
  const [completed, setCompleted] = useState<string[]>(completedLessonIds);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState(learners[0]?.id ?? "");
  const [enrolledLearner, setEnrolledLearner] = useState("");
  const [pendingLessonId, setPendingLessonId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [commenting, setCommenting] = useState(false);

  async function enroll() {
    if (viewerRole === "instructor" && !selectedLearnerId) {
      setNotice("Choose a learner before enrolling.");
      return;
    }
    setEnrolling(true);
    const body = { courseId: course.id, ...(viewerRole === "instructor" ? { learnerId: selectedLearnerId } : {}) };
    try {
      const response = await fetch("/api/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) {
        setNotice(result.error ?? "Could not enroll");
        return;
      }
      if (viewerRole === "instructor") {
        const learner = learners.find((item) => item.id === selectedLearnerId);
        setEnrolledLearner(learner ? `${learner.full_name} (${learner.email})` : "learner");
        setNotice("Learner enrolled successfully.");
      } else {
        setEnrollment({ id: result.id, progress: "not_started" });
        setNotice("You’re enrolled. Start with the first lesson.");
      }
    } catch {
      setNotice("Network error. Please try again.");
    } finally {
      setEnrolling(false);
    }
  }

  async function complete(lessonId: string) {
    setPendingLessonId(lessonId);
    try {
      const response = await fetch("/api/progress/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId }) });
      const result = await response.json();
      if (!response.ok) {
        setNotice(result.error ?? "Could not update progress");
        return;
      }
      setCompleted((items) => items.includes(lessonId) ? items : [...items, lessonId]);
      setEnrollment((current) => current ? { ...current, progress: result.progress } : current);
      setNotice(result.progress === "completed" ? "Course completed — congratulations!" : "Lesson marked complete.");
    } catch {
      setNotice("Network error. Please try again.");
    } finally {
      setPendingLessonId(null);
    }
  }

  async function comment() {
    if (!message.trim()) return;
    setCommenting(true);
    try {
      const response = await fetch(`/api/courses/${course.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const result = await response.json();
      if (!response.ok) {
        setNotice(result.error ?? "Could not add comment");
        return;
      }
      setMessage("");
      setNotice("Comment added to the activity history.");
    } catch {
      setNotice("Network error. Please try again.");
    } finally {
      setCommenting(false);
    }
  }

  const canEnroll = course.status === "published";
  return <main className="detail-shell">
    <header className="detail-topbar"><Link href="/" className="back-link"><ArrowLeft size={16} /> Back to workspace</Link><span className="detail-logo">kinship<span>.</span></span></header>
    <div className="detail-wrap">
      <div className="detail-hero">
        <div><span className="detail-category">{course.category}</span><h1>{course.title}</h1><p>{course.description}</p><small>By {course.instructor ?? "Kinship instructor"} · {course.lessons.length} lessons</small></div>
        <div className="detail-status">
          {viewerRole === "instructor" ? <div className="instructor-enroll-box">
            <span className="status-label"><UserPlus size={15} /> Enroll a learner</span>
            <select aria-label="Learner to enroll" value={selectedLearnerId} onChange={(event) => setSelectedLearnerId(event.target.value)} disabled={!canEnroll || enrolling || learners.length === 0}>
              {learners.length === 0 ? <option value="">No learners found</option> : learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.full_name} · {learner.email}</option>)}
            </select>
            <button className="button button-primary" onClick={enroll} disabled={!canEnroll || enrolling || learners.length === 0}>{enrolling ? <><Loader2 size={15} className="spin" /> Enrolling…</> : <><UserPlus size={15} /> Enroll learner</>}</button>
            {!canEnroll && <small className="status-hint">Publish this course before enrolling learners.</small>}
            {enrolledLearner && <small className="status-success">✓ {enrolledLearner}</small>}
          </div> : enrollment ? <><strong>{enrollment.progress.replace("_", " ")}</strong><span>Your progress</span></> : canEnroll ? <button className="button button-primary" onClick={enroll} disabled={enrolling}>{enrolling ? <><Loader2 size={15} className="spin" /> Enrolling…</> : "Enroll in course"}</button> : <><strong>{course.status}</strong><span>Not open for enrollment</span></>}
        </div>
      </div>
      <div className="detail-grid">
        <section className="lesson-panel"><div className="panel-header"><div><p className="eyebrow">Course path</p><h2>Lessons</h2></div><span className="lesson-count">{completed.length}/{course.lessons.length} complete</span></div><div className="lesson-list">{course.lessons.map((lesson) => <article className="lesson-card" key={lesson.id}><div className="lesson-number">{completed.includes(lesson.id) ? <CheckCircle2 size={19} /> : <Circle size={19} />}</div><div className="lesson-copy"><span>Lesson {lesson.position}</span><h3>{lesson.title}</h3><p>{lesson.content}</p></div>{viewerRole === "learner" && enrollment && !completed.includes(lesson.id) && <button className="button button-secondary lesson-action" onClick={() => complete(lesson.id)} disabled={pendingLessonId === lesson.id}>{pendingLessonId === lesson.id ? <Loader2 size={14} className="spin" /> : "Complete"}</button>}</article>)}</div></section>
        <aside className="comment-panel"><div className="panel-header"><div><p className="eyebrow">Keep the conversation going</p><h2><MessageSquare size={17} /> Notes</h2></div></div><p className="panel-caption">Share a reflection or question with the instructor.</p><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What stood out to you?" rows={5} /><button className="button button-primary" onClick={comment} disabled={!message.trim() || commenting}>{commenting ? <><Loader2 size={15} className="spin" /> Adding…</> : <><Send size={15} /> Add comment</>}</button></aside>
      </div>
      {notice && <div className="detail-notice" role="status"><CheckCircle2 size={16} />{notice}</div>}
    </div>
  </main>;
}
