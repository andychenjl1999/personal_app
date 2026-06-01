# 2026-06-01 Google Auth Gate

## Summary

Added the planned web login gate using Supabase Auth with Google OAuth. The root web page now checks for a Supabase session, claims the single personal owner, and renders the todo list only after ownership is confirmed.

## Changes

- Added a Supabase migration for the singleton app owner, owner assignment, owner-claim RPC, authenticated owner-scoped RLS, and insert ownership triggers.
- Added a client auth gate around the web todo app.
- Added signed-in email and sign-out controls to the todo header.
- Enabled Google provider configuration for local Supabase and documented the required hosted setup.

## Notes

The first authenticated Google account to reach the app after migration becomes the durable personal owner. Existing no-auth todo and draft rows are assigned to that account by the owner-claim RPC.
