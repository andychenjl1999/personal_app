# All Incomplete Todos List View

## Summary

The web app now includes a dedicated `/todos` view for completing items from one simple, combined list.

## Behavior

- The view uses the shared incomplete-todo collection, so planned and in-progress scheduled and unscheduled items appear together in newest-created-first order.
- Every row shows a completion checkbox and title only. Titles open the existing update modal but are not draggable.
- A pending completion checks and disables its control. Successful saves remove the row and reconcile any compacted daily order; failed saves restore the control and display the shared error banner.
- Month and day headers link to **All todos**, and the list header links back to **Month view**.

## Verification

- `npx prettier --check apps/web/app/todos/page.tsx apps/web/app/todos/todo-list-view.tsx apps/web/app/todos/todo-app.tsx apps/web/app/todos/day-view.tsx apps/web/app/globals.css apps/web/app/layout.tsx apps/web/app/manifest.ts docs/features/todos.md docs/sessions/2026-08-07-all-todos-list-view.md`
- `npm run typecheck:web`
- `npm run build:web` (confirmed the generated route table includes `/todos`)
- `git diff --check`

## Manual Followup Work

- No new environment variables, migrations, provider settings, or external setup are required.
- Manually verify loading, editing, successful completion, and failed completion against the configured Supabase environment.
