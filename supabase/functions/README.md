# Edge Functions

Place privileged workflows, integrations, and non-trivial backend operations here as they are introduced.

## Todo Reminder Emails

`send-todo-reminder-emails` is invoked once per minute by Supabase Cron. It claims due todo reminders, sends reminder emails through Resend, and records success or failure state back to `public.todos`.

Required Edge Function secrets:

- `RESEND_API_KEY`: Resend API key.
- `REMINDER_EMAIL_TO`: single-owner recipient for v1 reminder emails.
- `REMINDER_EMAIL_FROM`: verified Resend sender, for example `Personal App <reminders@example.com>`.
- `REMINDER_EMAIL_TIME_ZONE`: optional display timezone; defaults to `America/Los_Angeles`.

Supabase provides `SUPABASE_URL` and secret API keys to deployed Edge Functions. Local function runs can use `SUPABASE_SERVICE_ROLE_KEY` as a compatibility fallback.

The database cron job invokes the function with a publishable key stored in Supabase Vault. Configure these Vault secrets for each Supabase project:

```sql
select vault.create_secret('https://yourproject.supabase.co', 'project_url');
select vault.create_secret('your_publishable_key', 'publishable_key');
```

The cron migration also accepts the older `anon_key` Vault name as a fallback for projects already configured with that naming.

If either Vault secret already exists, update it instead of creating a duplicate.
