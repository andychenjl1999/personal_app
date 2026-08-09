# Daily Execution Order

## Summary

- Added database-owned, one-based ordering for active scheduled todos.
- Backfilled existing scheduled rows and constrained each day to unique positive order values.
- Added an atomic move RPC that compacts the source day and ranks the destination day in one transaction.
- Added positional drag-and-drop to the daily view while keeping month moves append-only.
- Kept order values implicit in the UI and kept the unscheduled panel newest-first.

## Behavioral Notes

- Scheduled creation and execution-date changes append to the destination day.
- Completing, unscheduling, moving, or deleting a todo compacts its former day.
- The overdue rollover appends moved todos to today and normalizes the resulting list.
- Dragging remains based on the existing desktop HTML5 drag-and-drop behavior; no new UI dependency was introduced.

## Verification

- `npm run typecheck:web` passed.
- `npm run build:web` passed.
- Applying the migration and verifying drag, modal, completion, and rollover behavior against Supabase remain manual follow-up work.
