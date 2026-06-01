# Auth Feature

## Summary

The web app uses Supabase Auth with Google OAuth as the first application-level login gate. A signed-in user must claim the personal app owner record before the todo interface is shown.

## Owner Claiming

The first authenticated Google account that reaches the app becomes the single personal owner. The `claim_personal_app_owner()` Supabase RPC creates the owner record if none exists, assigns existing unowned todo and draft rows to that account, and rejects any later different account.

This means the intended personal Google account must sign in first after the auth migration is applied.

## Web Behavior

- Signed-out users see a login page with a `Continue with Google` button.
- After Google redirects back to the app, the web client checks the Supabase session and calls `claim_personal_app_owner()`.
- If ownership is confirmed, the todo list renders.
- If another account already owns the app, the user sees the ownership error and can sign out.
- The todo header shows the signed-in email and a sign-out button.

## Data Protection

Todos and the todo draft input use authenticated, owner-scoped RLS policies. The temporary anonymous policies from the no-auth phase are replaced by policies that require `owner_user_id = auth.uid()`.

New todos and draft rows are assigned to the signed-in user by database triggers. Existing rows from the no-auth phase are assigned to the first owner during the owner-claim RPC.

## Hosted Setup

Google OAuth must be configured outside the repo for hosted Supabase:

- Create Google OAuth web credentials.
- Add the Supabase Auth callback URL to Google authorized redirect URIs.
- Enable Google as an Auth provider in Supabase.
- Configure the deployed web origin as an allowed redirect URL in Supabase Auth.
- Set the provider client id and secret in the appropriate Supabase secret/config system.
