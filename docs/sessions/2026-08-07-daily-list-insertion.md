# Daily List Insertion

## Summary

- Added an **Add todo** control for every valid insertion point in the daily list.
- Kept between-row drag behavior precise by making the same controls positional drop targets.
- Reused the normal creation modal with the displayed execution date prefilled and locked.
- Added an atomic Supabase RPC that creates and ranks the todo in one transaction.
- Shifted existing local rows after successful creation so the selected position appears immediately.

## Behavioral Notes

- Position `1` inserts at the top, intermediate controls insert between rows, and position `n + 1` inserts at the bottom.
- Empty days expose one position-one control.
- The day header's general **New todo** flow remains date-editable and append-only.
- Completed creation retains the existing hidden-completed behavior and does not participate in daily order.

## Verification

- `npm run typecheck:web` passed.
- `npm run build:web` passed.
- Applying the migration and verifying empty, top, middle, and bottom insertion against Supabase remain manual follow-up work.
