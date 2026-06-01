# ADR-0002: Vercel Standard Protection For Web Access

## Status

Superseded for application data protection. Vercel Deployment Protection remains an outer deployment-access control.

## Context

The web app started as a single-user personal app with no application-level login, and the browser client talked directly to Supabase with public Supabase environment values.

The original Supabase row level security policies intentionally allowed anonymous access for the no-auth phase. Google OAuth and owner-scoped Supabase RLS are now the application/data protection model for todos.

## Decision

Keep Vercel Deployment Protection with:

- Protection scope: `Standard Protection`
- Protection method: `Vercel Authentication`

This protects preview deployments and generated Vercel deployment URLs. It does not make production or custom domains private under the selected Standard Protection model.

Application-level login is handled by Supabase Auth with Google OAuth. Todo data access is handled by authenticated, owner-scoped Supabase RLS.

## Consequences

- The app can still be accessed through protected Vercel deployment URLs for an additional outer gate.
- Do not attach or share a production/custom domain as a private app URL under this model; it should be treated as public unless a stronger protection scope is adopted.
- Supabase data protection no longer depends on Vercel blocking access to the deployed app bundle.
- The browser client still uses public Supabase environment values, but owner-scoped RLS is the data boundary.
- If the project later needs private production/custom domains, replace this decision with Vercel All Deployments protection or application/database-level auth.
