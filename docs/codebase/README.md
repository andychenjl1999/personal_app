# Codebase Notes

This section should describe the current repository structure and operational expectations as the codebase grows.

Current intended layout:

- `apps/web`: Next.js web client
- `apps/android`: Expo Android client
- `supabase`: database, policies, functions, and related backend assets
- `docs`: project documentation

Web deployment access:

- Vercel is the intended web host.
- The current web access gate is Vercel Deployment Protection with `Standard Protection` and `Vercel Authentication`.
- Standard Protection should be treated as protecting preview and generated Vercel deployment URLs, not production or custom domains.
- Until stronger auth lands, use protected Vercel deployment URLs for private personal access and treat any production/custom domain as public.
