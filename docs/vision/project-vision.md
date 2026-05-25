# Project Vision

## Product Direction

This project is a long-lived personal platform that will accumulate new features over time.

The product will ship as:

- one web application
- one Android application
- one shared backend

## Platform Principles

- Treat the backend as the core platform and single source of truth.
- Keep the web and Android apps as independent clients optimized for their own UX.
- Build for reliable personal production use, not just local experimentation.
- Add new capabilities as modular domains instead of ad hoc app-wide sprawl.
- Document durable decisions as the system evolves.

## Initial Technology Direction

- Web: `Next.js`
- Android: `Expo` / `React Native`
- Backend: `Supabase`
- Web hosting: `Vercel`
- Auth: OAuth-based sign-in
- Distribution: private Android releases first
