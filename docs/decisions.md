# Decisions

Log the decisions that actually shaped this codebase — the ones where a real alternative existed and
you picked one. At least five entries. For each: what you chose, what you rejected, and why. At least
one entry must be a decision you later reversed — say what changed your mind. It can be any entry
below, not necessarily the last one; add a **Later reversed:** line to whichever one it is.

## Decision 1

- **Chose:** A Next.js monolith with Supabase.
- **Rejected:** A separate SPA/API deployment.
- **Why:** It keeps auth, server validation, UI, and deployment inside a small surface area for a 12-hour exercise.

## Decision 2

- **Chose:** Postgres enums and constraints for lifecycle values and uniqueness.
- **Rejected:** Free-form strings checked only in React.
- **Why:** Illegal data should be rejected even when a caller bypasses the UI.

## Decision 3

- **Chose:** Append-only activity log rows.
- **Rejected:** An editable “last updated” field or mutable comments table.
- **Why:** The assignment explicitly requires history that cannot be rewritten.

## Decision 4

- **Chose:** Derive inactivity from `last_progress_at` plus a dismissal snapshot.
- **Rejected:** A scheduled email/worker system.
- **Why:** The alert is a queryable product state and does not need another runtime at this scale.

## Decision 5

- **Chose:** Store both lesson completion rows and current enrollment progress.
- **Rejected:** Calculating every dashboard metric from lesson rows on every request.
- **Why:** Detail remains auditable while common lists and alerts stay fast. Later reversed: the first prototype kept only a percentage on enrollment; adding lesson rows was necessary to prove completion and support ordered lessons.
