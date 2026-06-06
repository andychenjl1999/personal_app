# Edge Functions

Place privileged workflows, integrations, and non-trivial backend operations here as they are introduced.

## Todo Reminder Emails

`send-todo-reminder-emails` is invoked once per minute by Supabase Cron. It claims due todo reminders, sends reminder emails through Resend, and records success or failure state back to `public.todos`.

Required Edge Function secrets:

- `RESEND_API_KEY`: Resend API key.
- `REMINDER_EMAIL_TO`: single-owner recipient for v1 reminder emails.
- `REMINDER_EMAIL_FROM`: verified Resend sender, for example `Personal App <reminders@example.com>`.
- `REMINDER_EMAIL_TIME_ZONE`: optional display timezone; defaults to `America/Los_Angeles`.

Supabase's `withSupabase({ auth: 'secret' })` wrapper validates service-to-service calls with a Supabase secret key sent on the `apikey` header. Keep JWT verification disabled for this function so Supabase Cron can call it with `pg_net`.

The database cron job invokes the function with a secret key stored in Supabase Vault. Configure these Vault secrets for each Supabase project:

```sql
select vault.create_secret('https://yourproject.supabase.co', 'project_url');
select vault.create_secret('your_secret_key', 'edge_function_secret_key');
```

The cron request must send the secret key as the `apikey` header. Do not send publishable keys or anon JWTs as bearer tokens for this service-to-service function.

If either Vault secret already exists, update it instead of creating a duplicate.
