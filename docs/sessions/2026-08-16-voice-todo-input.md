# Web Voice Todo Input

## Summary

- Added a reusable browser speech-recognition control to the month and day headers.
- Supported quick-tap toggle, 300-millisecond hold-to-talk, and keyboard toggle interactions.
- Created successful transcripts through the existing todo collection path with the execution date set to device-local today.
- Added visible listening, processing, success, error, and unsupported-browser states without storing audio or adding backend infrastructure.

## Behavioral Notes

- Recognition uses English (United States), accepts one final utterance, trims surrounding whitespace, and otherwise preserves the transcript.
- Releasing an intentional hold asks the browser to finalize captured speech. Pointer cancellation and navigation abort recognition without saving a partial item.
- Database failures remain owned by the collection error banner and do not produce a false success state.
- The Web Speech API may use a browser-vendor recognition service and does not provide uniform cross-browser or offline support.

## Verification

- `npx prettier --check apps/web/app/todos/voice-todo-button.tsx apps/web/app/todos/todo-app.tsx apps/web/app/todos/day-view.tsx apps/web/app/globals.css docs/features/voice-todo-input.md docs/features/todos.md docs/sessions/2026-08-16-voice-todo-input.md`
- `npm run typecheck:web`
- `npm run build:web`
- `git diff --check`

## Manual Followup Work

- Grant microphone permission and verify tap, hold, keyboard, permission-denied, no-speech, backend-failure, and unsupported-browser behavior on each intended browser and device over HTTPS or localhost.
- No new environment variables, API keys, migrations, provider settings, or scheduled jobs are required.
