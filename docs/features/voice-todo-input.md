# Voice Todo Input

## Summary

Voice todo input is a fast web capture path for creating one todo from a short spoken English phrase. It is available in the month and day headers and always schedules the created todo for the device-local current date.

## Web Behavior

- A quick tap starts browser speech recognition, and the next tap stops it. Recognition can also finish naturally after the user stops speaking.
- Holding the button for at least 300 milliseconds starts recognition in hold mode. Releasing requests the final transcript without also triggering the tap action.
- Enter and Space use the tap-toggle behavior so the control does not require a pointer.
- Recognition uses English (United States), one utterance, and one final alternative. The final transcript is trimmed but otherwise preserved as the todo title.
- The button displays listening, transcribing, saving, and temporary success states. Permission, recognition, and microphone failures use the existing todo error banner.
- Unsupported browsers display a disabled `Voice unavailable` control. The normal typed todo workflow remains available.
- Pointer cancellation and component cleanup abort recognition without creating a partial todo.

## Persistence

The control calls the existing todo collection create path with the recognized title and the local-midnight Unix timestamp for today. Normal todo defaults and database-owned daily execution ordering remain unchanged. The app stores only the returned transcript and does not store audio.

No Supabase schema, migration, RPC, RLS, API route, new package, or environment variable is required.

## Browser and Privacy Constraints

The Web Speech API has limited browser support. Depending on the browser, recognition can send audio to a browser-vendor service and require an internet connection. This limitation is accepted for the first version; provider-hosted audio upload and guaranteed on-device recognition remain possible future alternatives.

## Android Considerations

The Android client does not yet implement the todo workflow, so voice todo input is web-only. A native Android version should be designed when that client gains its Supabase todo data layer rather than sharing browser-specific recognition code.

## Manual Followup Work

- Allow microphone access and verify tap, hold, keyboard, permission-denied, no-speech, and unsupported-browser behavior on each intended device and browser over HTTPS or localhost.
- No API keys, Supabase migrations, Vercel settings, provider configuration, or other dashboard setup is required.
