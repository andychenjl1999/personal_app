# ADR-0002: Vercel Standard Protection For Web Access

## Status

Accepted

## Context

The web app is currently a single-user personal app. It has no application-level login, and the browser client talks directly to Supabase with public Supabase environment values.

The current Supabase row level security policies intentionally allow anonymous access for the no-auth phase. This decision does not change those policies; it only defines the first access gate for deployed web URLs.

## Decision

Use Vercel Deployment Protection with:

- Protection scope: `Standard Protection`
- Protection method: `Vercel Authentication`

This protects preview deployments and generated Vercel deployment URLs. It does not make production or custom domains private under the selected Standard Protection model.

Only users with access through the Vercel project should be able to open protected deployment URLs. For now, this is the only web access gate.

## Consequences

- The app should be accessed through protected Vercel deployment URLs while this decision is in force.
- Do not attach or share a production/custom domain as a private app URL under this model; it should be treated as public unless a stronger protection scope is adopted.
- Supabase data protection still depends on the current temporary no-auth RLS policies and Vercel blocking access to the deployed app bundle.
- A later auth hardening pass should replace permissive Supabase `anon` policies with authenticated, owner-scoped policies or move data access behind server-only routes.
- If the project later needs private production/custom domains, replace this decision with Vercel All Deployments protection or application/database-level auth.
