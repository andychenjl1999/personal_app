# Todo Draft Input Feature

## Summary

The todo draft input is a backlog scratchpad for rough todo ideas before they are promoted into structured todos. The backend stores the entire draft area as one string so the writing surface can stay flexible while still supporting line-by-line conversion into todo items.

## Backend Shape

- `content`: required text string. Empty text is valid because clearing the draft input should persist.
- `createdAt`: internal timestamp for the first saved draft row.
- `updatedAt`: internal timestamp managed by Supabase whenever the draft string changes.

The `public.todo_draft_input` table is a singleton table constrained to `id = 1`. This keeps the current workflow to one durable draft buffer rather than a list of partially structured records.

## Persistence

The web app uses `getTodoDraftInput` and `saveTodoDraftInput` helpers against Supabase. Saving uses an upsert so the first edit creates the singleton row and later edits update the same row.

The current no-auth single-user phase uses temporary permissive anon RLS policies. These policies must be replaced with owner-scoped rules when authentication is introduced.

## Web Behavior

- The month and day view headers include a `Draft todos` button that opens the draft modal.
- The modal loads the saved draft string when opened.
- Users save changes explicitly with the `Save draft` button. Closing the modal discards unsaved edits.
- The textarea stores the draft exactly as typed, including empty text and newlines.
- Users convert draft lines into todos with the `Convert todos` button.
- Starting conversion saves the visible draft, trims each line, skips blank lines, and opens the normal create-todo modal for each non-empty line in order.
- Each create modal starts with the current draft line as its title. Every field exposed by the normal create modal remains editable, including the execution date, which starts unassigned even when conversion began from a day view.
- Successfully creating an item removes only that source line from the persisted draft before advancing to the next create modal. Duplicate titles remain separate queue entries.
- Closing or canceling a create modal stops the sequence and returns to the underlying view. Successfully converted lines stay removed, while the current and remaining lines stay saved.
- If todo creation fails, the current create modal remains open. If creation succeeds but draft cleanup fails, conversion stops and warns that the created todo's source line may need manual removal.
- If loading the draft fails, only the draft modal is disabled; the normal structured todo workflow remains available.

## Future Work

- Decide whether saving should also happen on debounce.
- Decide whether converted drafts need an archive or conversion history.
- Consider a transactional database function if draft cleanup and todo creation need atomic guarantees.
