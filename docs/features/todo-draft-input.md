# Todo Draft Input Feature

## Summary

The todo draft input is a backlog scratchpad for rough todo ideas before they are promoted into structured todos. The first backend stores the entire draft area as one string so the writing surface can stay flexible while parsing and promotion workflows are designed later.

## Backend Shape

- `content`: required text string. Empty text is valid because clearing the draft input should persist.
- `createdAt`: internal timestamp for the first saved draft row.
- `updatedAt`: internal timestamp managed by Supabase whenever the draft string changes.

The `public.todo_draft_input` table is a singleton table constrained to `id = 1`. This keeps the current workflow to one durable draft buffer rather than a list of partially structured records.

## Persistence

The web app uses `getTodoDraftInput` and `saveTodoDraftInput` helpers against Supabase. Saving uses an upsert so the first edit creates the singleton row and later edits update the same row.

The current no-auth single-user phase uses temporary permissive anon RLS policies. These policies must be replaced with owner-scoped rules when authentication is introduced.

## Future Work

- Build the large text input UI.
- Decide whether saving happens explicitly, on debounce, or both.
- Design promotion from draft lines into structured todos.
- Decide whether old promoted text is removed, archived, or left in place.
