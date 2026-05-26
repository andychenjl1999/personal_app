# Todo List Feature

## Summary

The todo list is the first web feature for the personal app platform. The first version is web-only and stores todos in browser `localStorage` so the workflow can be validated before adding Supabase persistence.

## Todo Fields

- `title`: required non-empty text.
- `status`: required after creation. New todos are always created as `planned`.
- `priority`: required, one of `low`, `medium`, or `high`.
- `dueDate`: optional Unix timestamp in seconds. It represents 12:00am on the selected due date in the user's local timezone.
- `reminderTime`: optional Unix timestamp in seconds. It represents the selected local date and time, specific to the minute.
- `createdAt`: internal timestamp used for the default newest-first order.

## Web Behavior

- Users can create todos from the main web interface.
- Users can update todo fields inline in the list.
- Users select due dates with a date input.
- Users select reminders with a date-and-time input.
- Users can mark a todo complete with a checkbox.
- Completing a todo sets its status to `completed`.
- A completed todo checkbox cannot be unchecked in this first version.
- Status can otherwise move between `planned` and `in progress`.

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

Todos are stored under the `localStorage` key `personal-app-v2.todos.v2`. This is intentionally frontend-only for the first implementation pass.

The `v2` storage key resets the earlier string-based date schema. Old `personal-app-v2.todos` browser data is not migrated.

Supabase persistence, cross-device sync, reminders, and Android support are future follow-up work.
