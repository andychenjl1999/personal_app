# Personal App v2

This repository is the foundation for a long-lived personal platform with:

- a `Next.js` web app
- an `Expo` Android app
- a shared `Supabase` backend

The product is intentionally single-user at first and optimized for reliable personal production use rather than public multi-user scale.

## Architecture

- `apps/web`: web client deployed to Vercel
- `apps/android`: Android client built with Expo / React Native
- `supabase`: backend configuration, migrations, and server-side logic
- `docs`: product, architecture, and session documentation

The web and Android frontends are separate codebases. Shared behavior should live in backend contracts, data rules, and server-side workflows rather than shared UI packages.

## Getting Started

1. Copy `.env.example` values into environment files appropriate for each app.
2. Install dependencies with `npm install`.
3. Run the web app with `npm run dev:web`.
4. Run the Android app with `npm run dev:android`.

## Documentation

Use the `docs/` directory as the source of truth for vision, feature specs, decisions, sessions, and codebase notes.
