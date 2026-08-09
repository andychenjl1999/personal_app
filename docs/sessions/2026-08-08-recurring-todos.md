# Recurring Todo Creation

## Summary

- Added a recurring-todo modal to the month and day view headers.
- Added bounded recurrence generation for calendar days, weekdays, weeks, months, and years.
- Added one-statement Supabase batch creation so all generated occurrences succeed or fail together as independent todo rows.
- Added a live occurrence count before submission.

## Behavioral Notes

- All frequencies can end 3 months, 6 months, 1 year, or 2 years after the start date, and the calculated boundary is inclusive.
- The start date is always the first occurrence and must be today or later.
- Weekday recurrence skips Saturday and Sunday and requires a Monday-through-Friday start.
- Monthly and yearly recurrence clamps missing dates to the target month's final day without losing the original day-of-month anchor.
- Generated todos use standard planned-todo defaults and can be updated independently. No recurrence metadata or series-wide editing is introduced.
- Repeating the same recurring creation is allowed and can create duplicate title/date combinations.

## Verification

- Run targeted Prettier checks.
- Run `npm run typecheck:web`.
- Run `npm run build:web`.
- Manually verify recurrence boundaries, weekday skipping, month-end clamping, batch failure handling, and independent editing against Supabase.

## Manual Followup Work

- Verify bulk inserts and database-assigned daily execution order in each target Supabase environment.
- No migrations, environment variables, API keys, scheduled jobs, or provider dashboard changes are required.
