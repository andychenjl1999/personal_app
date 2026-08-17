# Recurring Todo Specific End Date

## Summary

- Replaced the recurring-todo duration presets with a required native date input.
- Kept the existing two-year batch horizon while allowing any exact end date inside it.
- Preserved the live occurrence preview and inclusive boundary behavior.

## Behavioral Notes

- The end date starts blank and must be selected explicitly.
- Valid end dates run from the start date through the anchored date two calendar years later.
- Changing the start date does not silently replace an end date the user already selected. An invalid combination remains visible and disables creation until corrected.
- Weekday skipping and anchored monthly and yearly recurrence behavior are unchanged.

## Verification

- `npx prettier --check apps/web/app/todos/recurring-todo-modal.tsx apps/web/app/todos/recurring-todo.ts docs/features/todos.md docs/sessions/2026-08-16-recurring-todo-end-date.md`
- `npm run typecheck:web`
- Production build passed from `apps/web` with `node --max-old-space-size=4096 ../../node_modules/next/dist/bin/next build`. The standard npm build command compiled successfully first but its worker exhausted the default Node heap during the TypeScript phase in the local environment.
- Direct module assertions covered missing, reversed, and over-limit end dates; same-day and inclusive daily boundaries; weekday skipping; month-end and leap-date anchoring; and an interval beyond the selected horizon.
- `git diff --check`

## Manual Followup Work

- Verify one successful recurring batch and database-assigned daily execution order in each target Supabase environment.
- Manually verify the native end-date constraints and live occurrence preview in a supported browser.
- No migrations, environment variables, API keys, scheduled jobs, or provider dashboard changes are required.
