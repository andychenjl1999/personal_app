# Daily Execution Time Editor

## Summary

- Added an execution-time text input to the left of every scheduled todo in the daily view.
- Reused the shared todo update path so edits persist to `execution_time` and backend errors use the existing banner.
- Added a 500ms typing debounce with an immediate blur save to avoid one Supabase request per keystroke.
- Preserved row editing, positional drag targets, and daily insertion controls.

## Behavioral Notes

- The field displays the stored execution-time string without applying the modal's time-input formatting.
- Clearing the field persists a null execution time.
- Pressing Enter blurs the field and flushes its pending save.
- Failed saves keep the typed draft available for another edit or blur retry.

## Verification

- `npm run typecheck:web` passed.
- `npm run build:web` passed.
- Verifying editing, clearing, debounced saving, blur saving, and error handling against Supabase remains manual follow-up work.
