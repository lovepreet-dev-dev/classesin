# Plan

The work was split into seven focused sessions: foundation/auth; schema and authorization; instructor course/lesson management; learner enrollment/progress; discovery/bulk tools; dashboard/alerts; and testing/deployment/documentation. The order follows dependencies: identity and constraints first, then content, then learner behavior, then reporting and polish.

The estimate was approximately 12 hours: 1.5h setup, 2h schema/auth, 2h instructor tools, 2h learner flows, 1.5h search/bulk/export, 1.5h dashboard/alerts, and 1.5h verification/deployment. Actual work was approximately 12 hours. The only cuts were optional quizzes, certificates, video delivery, email notifications, and a background scheduler; server authorization, state validation, audit history, bulk results, and documentation were kept.

The dependency order also made local verification reproducible: each later flow can be exercised against the schema and seeded identities created by the earlier sessions.
