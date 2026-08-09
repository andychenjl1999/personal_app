# Todo Calendar Feature

## Summary

The web todo experience is organized around independently loaded month, day, and all-incomplete list views. Every view uses the existing Supabase `public.todos` table and the shared client data functions in `apps/web/app/todos/todo-data.ts`.

The previous combined scratchpad, inline todo editor, and daily planner screen is no longer the web entry point. Draft capture is available through a shared modal, while the separate daily-planner backend table remains in the repository without a current calendar UI.

## Todo Fields

- `title`: required non-empty text.
- `progressNote`: optional text, stored in `progress_note`.
- `status`: stored as `planned`, `in-progress`, or `completed`. The create/update modal exposes this as a Complete checkbox; unchecked saves `planned`, including when an existing `in-progress` todo is updated.
- `priority`: `low`, `medium`, or `high`. It is hidden from the create/update modal; new todos default to `medium`, and updates preserve the saved value.
- `dueDate`: optional Unix timestamp in seconds stored in `due_date`. The calendar UI calls this the execution date and stores local midnight for the selected date to remain compatible with existing todo rows and rollover automation.
- `executionTime`: optional local time-of-day string stored in `execution_time`. The create/update modal and daily list accept native `HH:mm` time-input values and normalize populated values to `hh:mm am/pm`, such as `09:30 am`, before persistence.
- `dailyExecutionOrder`: database-managed, one-based integer stored in `daily_execution_order` for active scheduled todos. It is null for unscheduled and completed todos and remains hidden from the create/update modal.
- `reminderTime`: optional Unix timestamp in seconds stored in `reminder_time`, representing the selected local date and time.
- `createdAt` and `updatedAt`: internal database-managed timestamps.
- Reminder email delivery columns remain internal Supabase-owned state.

The migration `supabase/migrations/20260804000100_add_todo_execution_fields.sql` adds `execution_time` and `daily_execution_order`. The follow-up migration `supabase/migrations/20260807000100_enforce_daily_execution_order.sql` backfills scheduled todos, enforces positive per-day values, and owns automatic append and compaction behavior. `supabase/migrations/20260807000200_create_todo_at_daily_position.sql` adds atomic creation at a selected daily position.

## Shared Data Layer

`todo-data.ts` owns reusable list, create, update, and delete operations and maps Supabase snake-case rows to camel-case UI values. `use-todo-collection.ts` gives each view its own loading and mutation lifecycle while calling those shared backend functions.

The month, day, and list routes each fetch their todo data when mounted. Mutations return the selected database row so generated values, defaults, and update timestamps replace optimistic UI values. Drag operations update dates and orders optimistically, use one database transaction for every affected day, and restore the previous collection when Supabase rejects a move.

Scheduled todos are displayed by `dailyExecutionOrder`, with `1` at the top. The order is contiguous within each execution date and is implicit rather than displayed as a numeric label. Existing order is preserved during migration where possible; legacy unassigned rows use deterministic newest-first order.

Completed todos remain persisted in Supabase but are excluded from every web collection. Marking a visible item completed removes it immediately from the month calendar, day view, all-incomplete list, and unscheduled list without waiting for a reload.

## Create and Update Modals

The month and day views include **New todo** and **Recurring todo** actions. The standard create modal supports title, progress note, completion state, execution date, execution time, and reminder time. Title is required, and the remaining visible fields have safe defaults or can be left blank.

Clicking a todo title opens the update modal with the same visible fields. Clearing a visible optional input clears its persisted value. Priority and daily execution order are omitted from direct updates; the database appends or compacts daily order when the execution date or completion state changes.

Creating from a day view defaults the execution date to that day. Creating from the month header leaves the execution date unassigned.

The day-list insertion controls open the same create modal with the displayed date prefilled and locked. The selected one-based position is applied only to active todos; deliberately creating the item as completed keeps the existing hidden-completed behavior and does not assign daily order. The day header's general **New todo** action remains editable and appends normally.

## Recurring Todo Creation

The **Recurring todo** modal creates a bounded set of ordinary scheduled todos rather than a persisted recurrence series. It accepts a shared title, a start date, a positive whole-number interval, a frequency unit, and an inclusive duration measured from the start date. Month view defaults the start date to today, while day view defaults it to the displayed date. Start dates before today are rejected.

- Frequency units are calendar days, weekdays, weeks, months, and years. Weekday recurrence counts Monday through Friday and requires a weekday start.
- The available end durations are 3 months, 6 months, 1 year, and 2 years for every frequency.
- The start date is always included. An occurrence exactly on the calculated end date is included as well.
- Monthly and yearly schedules preserve the original day-of-month anchor. Missing target dates clamp to the target month's final day, then later occurrences return to the original day when possible.
- The modal previews the number of individual todos before creation. Each row uses normal creation defaults, receives database-owned daily order, and has no stored relationship to the other generated rows.
- Supabase receives the occurrences in one bulk insert. The complete batch succeeds or fails together; retrying a successful schedule is allowed and can create duplicates.

After creation, changing any generated todo affects only that todo. There is no series-wide update or deletion behavior.

## Draft Todo Conversion

The month and day view headers include a **Draft todos** action backed by the existing singleton `todo_draft_input` row. The draft modal loads and explicitly saves the full scratchpad string.

**Convert todos** treats every trimmed non-empty line as a separate queued item. It opens the normal create modal one at a time with only the title prefilled. The execution date begins unassigned, and every field exposed by the normal create modal remains editable.

After each successful creation, the corresponding source line is removed from the persisted draft before the next modal opens. Canceling stops the sequence and preserves every unprocessed line. Once the final item succeeds, the draft is empty and the user returns to the underlying calendar or day view.

## Month Calendar

The root route displays a full Sunday-through-Saturday month grid, including the adjacent dates required to complete its first and last weeks. Users can navigate to previous and next months or return to the current month.

- A scheduled todo is shown on its execution date with title text only.
- An unscheduled todo is shown in the side panel.
- Todo titles can be dragged between calendar days.
- Dragging a title to the unscheduled panel clears its execution date.
- Dragging an unscheduled title onto a day assigns that execution date.
- Month drops append the moved todo to the bottom of the destination day and compact the source day. Dropping onto the same day is a no-op; precise ordering is handled in the day view.
- Clicking or keyboard-activating a day opens `/day/YYYY-MM-DD`.
- Clicking a title opens its update modal without navigating away from the month.

## Day View

`/day/YYYY-MM-DD` displays todo titles assigned to the requested execution date and a separate unscheduled side panel.

- Dragging an unscheduled title into the main day panel assigns the displayed date.
- Dragging a scheduled title to the unscheduled panel clears its execution date.
- Dragging over the upper or lower half of a scheduled title inserts before or after it. Dropping elsewhere in the main panel appends to the bottom.
- Compact **Add todo** dividers appear above, between, and below scheduled rows. Selecting one creates at that exact position, and dropping an existing todo on one moves it there; an empty day exposes a single position-one control.
- Each scheduled row has a completion checkbox as its leftmost control. Checking it marks the todo completed, removes the hidden completed item from the day, and compacts the remaining daily execution orders.
- Each scheduled row displays a native minute-level execution-time input to the left of the title. Its value uses 24-hour `HH:mm` semantics, changes autosave after a short pause, and leaving the field flushes any pending save immediately; clearing the input clears the stored value.
- Previous-day and next-day drop targets move a todo directly to either adjacent date.
- Header arrows navigate between adjacent day routes.
- **Back to month** returns to the month containing the displayed date.
- Clicking a title opens its update modal.

## All Incomplete Todos List

`/todos` displays every planned or in-progress todo in one list, including both scheduled and unscheduled items. Rows remain in the existing newest-created-first query order.

- Each row displays only a completion checkbox and the todo title.
- Checking a row marks it completed, removes it from the list, and compacts its daily execution order when it was scheduled.
- The checkbox remains checked and disabled while completion is pending. A failed save restores the unchecked state and displays the shared error banner.
- Clicking a title opens the existing update modal without adding drag behavior to the list.
- **Month view** returns to the root calendar. The month and day headers expose an **All todos** link to this route.

## Persistence and Access

Todos remain in `public.todos`. The browser Supabase client uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

The project is still in its single-user no-auth phase. Temporary permissive anonymous RLS policies remain in effect and must be replaced with owner-scoped policies when authentication is introduced. Vercel Deployment Protection does not provide row-level database authorization.

## Existing Automation

The existing daily overdue-todo rollover continues to update incomplete `due_date` values. Rolled-over todos append to the current day, and the destination is normalized after the batch. Creating, rescheduling, completing, or deleting a todo uses the same database-owned ordering rules.

The existing reminder email workflow continues to use `reminder_time`; this feature does not change its claim, retry, or delivery behavior.

## Manual Followup Work

- Apply all execution-order migrations to each target environment before deploying the rebuilt web frontend. The frontend selects the new columns and calls the daily move and create RPCs, so it cannot provide the calendar workflow against an unmigrated database.
- Verify drag and drop in each supported desktop browser. On touch-only devices, execution dates remain editable through the create and update modals.
- Verify saved draft loading and the sequential conversion flow against the target Supabase environment.
- Verify recurring date generation, bulk creation, and daily-order assignment against the target Supabase environment.
- No new environment variables, API keys, provider settings, DNS changes, or scheduled jobs are required.
