# Todo List Feature

## Summary

The todo list is the first web feature for the personal app platform. The current version is web-only and stores todos in Supabase so the workflow can persist beyond one browser.

## Todo Fields

- `title`: required non-empty text.
- `status`: required after creation. New todos are always created as `planned`.
- `priority`: required, one of `low`, `medium`, or `high`.
- `dueDate`: optional Unix timestamp in seconds. It represents 12:00am on the selected due date in the user's local timezone.
- `reminderTime`: optional Unix timestamp in seconds. It represents the selected local date and time, specific to the minute.
- `createdAt`: internal timestamp used for the default newest-first order.
- `updatedAt`: internal timestamp managed by Supabase whenever a row changes.

## Web Behavior

- Users can create todos from the main web interface.
- Users can update todo fields inline in the list.
- Users select due dates with a date input.
- Users select reminders with a date-and-time input.
- Users can mark a todo complete with a checkbox.
- Completing a todo sets its status to `completed`.
- A completed todo checkbox cannot be unchecked in this first version.
- Status can otherwise move between `planned` and `in progress`.
- Status and priority selectors, including their dropdown options, use value-specific colors:
  - status `planned`: blue `#2563EB`
  - status `in-progress`: amber `#D97706`
  - status `completed`: green `#16A34A`
  - priority `low`: gray `#6B7280`
  - priority `medium`: amber `#D97706`
  - priority `high`: red `#DC2626`

## Sorting

The list defaults to newest-created first.

Users can sort by:

- name
- priority
- due date
- reminder time
- status

Each sort can toggle between ascending and descending direction. Optional due dates and reminder times sort after populated values in ascending order and before populated values in descending order.

## Persistence

Todos are stored in the Supabase `public.todos` table. The web app uses the browser Supabase client with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Old browser `localStorage` data is ignored and is not migrated into Supabase.

The current no-auth single-user phase uses temporary permissive anon RLS policies. These policies must be replaced with owner-scoped rules when authentication is introduced.

## Automated Due Date Rollover

Supabase Cron runs a database function once per day at 5:00am in the `America/Los_Angeles` timezone. If an incomplete todo has a populated due date before the current Pacific calendar day, the job updates `dueDate` to today's local-midnight Unix timestamp.

Completed todos and todos without due dates are left unchanged. A run-log table records each Pacific date so duplicate invocations on the same day do not repeat the rollover.

Cross-device sync, reminders, per-user timezones, and Android support are future follow-up work.
