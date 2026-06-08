# Todo List Feature

## Summary

The todo list is the first web feature for the personal app platform. The current version is web-only and stores todos in Supabase so the workflow can persist beyond one browser.

## Todo Fields

- `title`: required non-empty text.
- `progressNote`: optional text for the todo's current progress. It defaults to an empty string and can be cleared.
- `status`: required after creation. New todos are always created as `planned`.
- `priority`: required, one of `low`, `medium`, or `high`.
- `dueDate`: optional Unix timestamp in seconds. It represents 12:00am on the selected due date in the user's local timezone.
- `reminderTime`: optional Unix timestamp in seconds. It represents the selected local date and time, specific to the minute.
- `createdAt`: internal timestamp used for the default newest-first order.
- `updatedAt`: internal timestamp managed by Supabase whenever a row changes.
- Reminder email delivery fields are internal Supabase-owned state used to claim, retry, and mark reminder emails as sent.

## Web Behavior

- Users can create todos from the main web interface.
- Creating a todo does not ask for a progress note; new todos start with an empty note.
- Users can convert draft todo lines into title-only todos. Draft-converted todos use database defaults for status, priority, progress note, due date, and reminder time.
- Users can update todo fields inline in the list.
- Users can update the progress note inline with a multi-line text area on each todo item.
- Users select due dates with a date input.
- Existing todo due date edits are drafted locally while the date field is active and saved when the field loses focus.
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
- Users can filter the displayed list locally by due date (`all`, `today`, `unspecified`), status (`all`, `planned`, `in progress`), and priority (`all`, `low`, `medium`, `high`). These filters do not change Supabase queries or persisted todo data.

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

## Reminder Emails

Supabase Cron invokes the `send-todo-reminder-emails` Edge Function once per minute. The function claims due reminder rows before sending so overlapping invocations do not send the same reminder twice.

The first reminder email version is single-owner only. Emails are sent to the server-side `REMINDER_EMAIL_TO` address through Resend, not to per-user recipients. Per-user reminder recipients should be added after authentication and owner-scoped todo rows exist.

Eligible reminders are incomplete todos with a populated `reminderTime` at or before the current time, no successful reminder email send, fewer than three failed send attempts, and no active non-stale claim. Claims older than 10 minutes are treated as stale so failed function runs can be retried.

Changing a todo's `reminderTime` resets reminder email delivery state so the changed reminder can send once at the new time. Completed todos and todos without reminders are ignored.

Reminder email display times default to `America/Los_Angeles` unless `REMINDER_EMAIL_TIME_ZONE` is configured for the Edge Function.

Cross-device sync, per-user timezones, per-user reminder recipients, reminder delivery webhooks, and Android support are future follow-up work.
