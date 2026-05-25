# ADR-0001: Managed-First Monorepo Architecture

## Status

Accepted

## Context

The project needs to support a web app and an Android app while staying easy to evolve as a solo-maintained personal platform.

## Decision

Use a monorepo with:

- `Next.js` for the web app
- `Expo` / `React Native` for the Android app
- `Supabase` as the managed backend
- `Vercel` as the intended web hosting target

The web and Android frontends remain separate implementations. Shared logic should primarily live in backend rules, data models, and server-side workflows rather than shared frontend packages.

## Consequences

- Feature work should be designed API-first against the backend boundary.
- The backend must remain stable enough for both clients to evolve independently.
- Operational complexity stays lower than a custom backend-first architecture.
- Vendor lock-in is accepted in exchange for faster solo shipping.
