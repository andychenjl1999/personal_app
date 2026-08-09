# Daily Execution Time Format

## Summary

- Changed the daily todo execution-time editor from unrestricted text to the same native time input used by the create/update modal.
- Reused the shared time conversion helpers so the browser edits `HH:mm` values while Supabase continues storing normalized `hh:mm am/pm` strings.
- Preserved the existing debounced autosave, immediate blur and Enter save, clearing, and failed-save retry behavior.

## Behavioral Notes

- The execution time remains optional and clears to `NULL`.
- Native time controls expose minute-level `HH:mm` values, although their visual presentation can follow browser locale conventions.
- Malformed legacy stored strings appear as an empty control and remain persisted until the user deliberately selects a valid time.

## Verification

- Run `npm run typecheck:web`.
- Run `npm run build:web`.
- Manually verify morning and evening conversion, clearing, debounced saving, blur and Enter saving, and backend error handling in supported desktop browsers.

## Manual Followup Work

- No environment variables, Supabase migrations, dashboard settings, or deployment changes are required.
