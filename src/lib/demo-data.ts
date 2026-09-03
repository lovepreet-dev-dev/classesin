export type DemoTone = "coral" | "lavender" | "mint" | "yellow" | "blue" | "slate";

export type DemoPerson = {
  id: string;
  fullName: string;
  email: string;
  initials: string;
  tone: DemoTone;
};

export type DemoLesson = {
  id: string;
  title: string;
  content: string;
  position: number;
};

export type DemoCourse = {
  id: string;
  title: string;
  description: string;
  category: string;
  instructor: string;
  instructorId: string;
  status: "Published" | "Draft" | "Archived";
  lessons: number;
  learners: number;
  progress?: "Not started" | "In progress" | "Completed";
  updated: string;
  accent: DemoTone;
};

export const DEMO_PASSWORD = "Demo123!";

export const DEMO_INSTRUCTORS: DemoPerson[] = [
  { id: "ae6cd731-e837-4ff1-af19-b667cf6d3e80", fullName: "Maya Patel", email: "maya@northstar.co", initials: "MP", tone: "coral" },
  { id: "ae6cd731-e837-4ff1-af19-b667cf6d3e81", fullName: "Jon Bell", email: "jon@northstar.co", initials: "JB", tone: "lavender" },
  { id: "ae6cd731-e837-4ff1-af19-b667cf6d3e82", fullName: "Priya Shah", email: "priya@northstar.co", initials: "PS", tone: "mint" },
  { id: "ae6cd731-e837-4ff1-af19-b667cf6d3e83", fullName: "Owen Brooks", email: "owen@northstar.co", initials: "OB", tone: "blue" },
];

export const DEMO_LEARNERS: DemoPerson[] = [
  { id: "2b136953-ae6d-425f-bab6-09de63426cd6", fullName: "Elena Garcia", email: "elena@northstar.co", initials: "EG", tone: "lavender" },
  { id: "2b136953-ae6d-425f-bab6-09de63426cd7", fullName: "Aarav Mehta", email: "aarav@northstar.co", initials: "AM", tone: "coral" },
  { id: "2b136953-ae6d-425f-bab6-09de63426cd8", fullName: "Noah Williams", email: "noah@northstar.co", initials: "NW", tone: "mint" },
  { id: "2b136953-ae6d-425f-bab6-09de63426cd9", fullName: "Sofia Chen", email: "sofia@northstar.co", initials: "SC", tone: "yellow" },
  { id: "2b136953-ae6d-425f-bab6-09de63426cda", fullName: "Liam Okafor", email: "liam@northstar.co", initials: "LO", tone: "blue" },
  { id: "2b136953-ae6d-425f-bab6-09de63426cdb", fullName: "Mia Thompson", email: "mia@northstar.co", initials: "MT", tone: "coral" },
  { id: "2b136953-ae6d-425f-bab6-09de63426cdc", fullName: "Lucas Martin", email: "lucas@northstar.co", initials: "LM", tone: "slate" },
  { id: "2b136953-ae6d-425f-bab6-09de63426cdd", fullName: "Amara Okeke", email: "amara@northstar.co", initials: "AO", tone: "mint" },
  { id: "2b136953-ae6d-425f-bab6-09de63426cde", fullName: "Theo Nguyen", email: "theo@northstar.co", initials: "TN", tone: "lavender" },
  { id: "2b136953-ae6d-425f-bab6-09de63426cdf", fullName: "Grace Kim", email: "grace@northstar.co", initials: "GK", tone: "yellow" },
  { id: "2b136953-ae6d-425f-bab6-09de63426ce0", fullName: "Mateo Silva", email: "mateo@northstar.co", initials: "MS", tone: "blue" },
  { id: "2b136953-ae6d-425f-bab6-09de63426ce1", fullName: "Priyanka Rao", email: "priyanka@northstar.co", initials: "PR", tone: "coral" },
  { id: "2b136953-ae6d-425f-bab6-09de63426ce2", fullName: "Ethan Brooks", email: "ethan@northstar.co", initials: "EB", tone: "slate" },
  { id: "2b136953-ae6d-425f-bab6-09de63426ce3", fullName: "Hana Park", email: "hana@northstar.co", initials: "HP", tone: "mint" },
  { id: "2b136953-ae6d-425f-bab6-09de63426ce4", fullName: "Caleb Jones", email: "caleb@northstar.co", initials: "CJ", tone: "lavender" },
  { id: "2b136953-ae6d-425f-bab6-09de63426ce5", fullName: "Isla Morgan", email: "isla@northstar.co", initials: "IM", tone: "yellow" },
];

const courseSpecs = [
  ["Security foundations", "Build practical habits for protecting customer data and company systems.", "Compliance", 48, "Published", 0],
  ["Leading with clarity", "A practical workshop for making decisions, giving feedback, and building trust.", "Leadership", 32, "Published", 1],
  ["The manager toolkit", "Rituals and tools for your first 90 days as a people manager.", "Leadership", 18, "Draft", 2],
  ["Customer conversations", "Turn difficult conversations into moments that build lasting relationships.", "Skills", 26, "Published", 0],
  ["Inclusive interviewing", "Create structured, equitable hiring loops that reveal great talent.", "People", 21, "Published", 1],
  ["Remote collaboration", "Design async-first ways of working that keep teams connected.", "Skills", 18, "Archived", 2],
  ["Data literacy essentials", "Use trustworthy data to make better everyday decisions.", "Skills", 35, "Published", 3],
  ["Coaching conversations", "Build confidence through practical coaching habits.", "Leadership", 29, "Published", 2],
  ["Privacy by design", "Make privacy a reliable part of product and process decisions.", "Compliance", 42, "Published", 0],
  ["Facilitation fundamentals", "Plan inclusive meetings that end with clear decisions.", "People", 0, "Draft", 1],
  ["Writing for impact", "Turn complex ideas into clear, useful communication.", "Skills", 31, "Published", 3],
  ["Manager onboarding", "A practical first month for new people leaders.", "Leadership", 38, "Published", 1],
  ["Product discovery", "Explore customer problems and shape better product bets.", "Product", 24, "Published", 3],
  ["Operational excellence", "Create repeatable systems that make good work easier.", "Operations", 27, "Published", 2],
  ["Giving great presentations", "Structure and deliver clear presentations for any audience.", "Communication", 22, "Published", 1],
  ["Responsible AI at work", "Use AI thoughtfully, securely, and transparently in daily work.", "Compliance", 17, "Published", 0],
  ["Hiring manager essentials", "Build a fair, focused process for every new hire.", "People", 14, "Archived", 2],
  ["Customer success playbook", "Turn customer insight into consistent, proactive support.", "Skills", 19, "Published", 3],
] as const;

const accentByCategory: Record<string, DemoTone> = {
  Compliance: "coral",
  Leadership: "lavender",
  Skills: "mint",
  People: "blue",
  Product: "yellow",
  Operations: "slate",
  Communication: "coral",
};

export const DEMO_COURSES: DemoCourse[] = courseSpecs.map(([title, description, category, learners, status, instructorIndex], index) => ({
  id: `c${index + 1}`,
  title,
  description,
  category,
  instructor: DEMO_INSTRUCTORS[instructorIndex].fullName,
  instructorId: DEMO_INSTRUCTORS[instructorIndex].id,
  status,
  lessons: 8,
  learners,
  progress: index % 7 === 0 ? "In progress" : index % 5 === 0 ? "Completed" : "Not started",
  updated: status === "Archived" ? "Archived Aug 12" : status === "Draft" ? "Edited 4h ago" : index % 3 === 0 ? "Updated 2h ago" : "Updated yesterday",
  accent: accentByCategory[category] ?? "slate",
}));

export const DEMO_LESSON_LIBRARY = [
  ["Start here", "Set the context, goals, and expectations for this learning path."],
  ["Core concepts", "Learn the essential ideas and vocabulary behind the topic."],
  ["A practical framework", "Use a repeatable framework to turn knowledge into action."],
  ["Common scenarios", "Work through realistic examples from everyday team situations."],
  ["Practice in context", "Apply the ideas to a short scenario and compare approaches."],
  ["Tools and templates", "Take away a lightweight tool you can use immediately."],
  ["Reflection", "Pause to connect the learning to your current work and goals."],
  ["Make it stick", "Choose one next step and make a plan to keep the habit going."],
] as const;

export function demoLessons(courseId: string): DemoLesson[] {
  const course = DEMO_COURSES.find((item) => item.id === courseId);
  return DEMO_LESSON_LIBRARY.map(([title, content], index) => ({
    id: `${courseId}-lesson-${index + 1}`,
    title: course ? `${title}: ${course.title}` : title,
    content,
    position: index + 1,
  }));
}

export const DEMO_WEEKLY = [
  { week: "Jul 15", completions: 8 },
  { week: "Jul 22", completions: 12 },
  { week: "Jul 29", completions: 9 },
  { week: "Aug 5", completions: 17 },
  { week: "Aug 12", completions: 14 },
  { week: "Aug 19", completions: 22 },
  { week: "Aug 26", completions: 19 },
  { week: "Sep 2", completions: 27 },
];

export const DEMO_ALERTS = [
  { id: "a1", enrollmentId: "demo-enrollment-1", name: "Aarav Mehta", initials: "AM", course: "Security foundations", days: 19, tone: "coral" as DemoTone },
  { id: "a2", enrollmentId: "demo-enrollment-2", name: "Elena Garcia", initials: "EG", course: "Leading with clarity", days: 16, tone: "lavender" as DemoTone },
  { id: "a3", enrollmentId: "demo-enrollment-3", name: "Noah Williams", initials: "NW", course: "Customer conversations", days: 15, tone: "mint" as DemoTone },
  { id: "a4", enrollmentId: "demo-enrollment-4", name: "Mia Thompson", initials: "MT", course: "Responsible AI at work", days: 22, tone: "yellow" as DemoTone },
];

export const DEMO_DASHBOARD = {
  totalLearners: DEMO_LEARNERS.length,
  publishedCourses: DEMO_COURSES.filter((course) => course.status === "Published").length,
  completionsThisMonth: 84,
  inProgress: 42,
  completionTotal: DEMO_WEEKLY.reduce((sum, item) => sum + item.completions, 0),
  weekly: DEMO_WEEKLY,
  courseBreakdown: DEMO_COURSES.map((course) => {
    const completed = Math.round(course.learners * 0.38);
    const inProgress = Math.round(course.learners * 0.34);
    return { course: course.title, enrolled: course.learners, completed, inProgress, notStarted: course.learners - completed - inProgress };
  }).sort((a, b) => b.enrolled - a.enrolled),
  progressBreakdown: [
    { progress: "completed", count: 84 },
    { progress: "in_progress", count: 42 },
    { progress: "not_started", count: 31 },
  ],
};

export const DEMO_ACTIVITY = [
  { id: "activity-1", courseId: "c1", t: "Course published", d: "Security foundations was published", by: "Maya Patel", when: "2 hours ago", event: "published" },
  { id: "activity-2", courseId: "c1", t: "Learner completed lesson", d: "Noah Williams completed ‘Handling customer data’", by: "System", when: "Today, 9:42 AM", event: "lesson_completed" },
  { id: "activity-3", courseId: "c1", t: "Comment added", d: "‘The examples in this module were very helpful.’", by: "Elena Garcia", when: "Yesterday", event: "commented" },
  { id: "activity-4", courseId: "c16", t: "Course edited", d: "Responsible AI at work received a lesson update", by: "Owen Brooks", when: "Yesterday", event: "edited" },
  { id: "activity-5", courseId: "c5", t: "Learner enrolled", d: "Sofia Chen joined Inclusive interviewing", by: "Maya Patel", when: "Aug 19, 2024", event: "enrolled" },
  { id: "activity-6", courseId: "c6", t: "Course archived", d: "Remote collaboration was archived", by: "Priya Shah", when: "Aug 12, 2024", event: "archived" },
];

export const DEMO_ACCOUNTS = [
  ...DEMO_INSTRUCTORS.map((person) => ({ ...person, role: "Instructor" as const })),
  ...DEMO_LEARNERS.map((person) => ({ ...person, role: "Learner" as const })),
];

export const DEMO_ENROLLMENT_EMAILS: Record<string, string[]> = {
  c1: ["elena@northstar.co", "aarav@northstar.co", "noah@northstar.co", "sofia@northstar.co", "liam@northstar.co"],
  c2: ["elena@northstar.co", "mia@northstar.co", "lucas@northstar.co", "amara@northstar.co"],
  c4: ["elena@northstar.co", "theo@northstar.co", "grace@northstar.co", "mateo@northstar.co"],
  c5: ["aarav@northstar.co", "sofia@northstar.co", "priyanka@northstar.co"],
  c7: ["noah@northstar.co", "liam@northstar.co", "ethan@northstar.co"],
  c8: ["mia@northstar.co", "hana@northstar.co", "caleb@northstar.co"],
  c9: ["lucas@northstar.co", "amara@northstar.co", "isla@northstar.co"],
  c11: ["theo@northstar.co", "grace@northstar.co", "mateo@northstar.co"],
  c12: ["priyanka@northstar.co", "ethan@northstar.co", "hana@northstar.co"],
  c13: ["caleb@northstar.co", "isla@northstar.co"],
  c14: ["elena@northstar.co", "liam@northstar.co"],
  c15: ["aarav@northstar.co", "mia@northstar.co"],
  c16: ["noah@northstar.co", "lucas@northstar.co"],
  c18: ["sofia@northstar.co", "amara@northstar.co", "priyanka@northstar.co"],
};
