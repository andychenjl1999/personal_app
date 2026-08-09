# Daily Completion Checkbox

## Summary

The day view now displays a completion checkbox as the leftmost control in every scheduled todo row.

## Behavior

- Checking the control saves the todo with `completed` status through the existing collection update path.
- The checkbox remains checked and disabled while the save is pending, preventing duplicate completion requests.
- A successful save removes the completed todo from the visible collection and reloads the compacted daily execution orders.
- A failed save restores the unchecked control and leaves the todo visible for another attempt. The existing error banner displays the backend error.

## Verification

- `npx prettier --check apps/web/app/todos/day-view.tsx apps/web/app/globals.css docs/features/todos.md docs/sessions/2026-08-07-daily-completion-checkbox.md`
- `npm run typecheck:web`
- `npm run build:web`
- `git diff --check`

## Manual Followup Work

- No new environment variables, migrations, provider settings, or external setup are required.
- Manually verify the pending, success, and error states against the configured Supabase environment.
