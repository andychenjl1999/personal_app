create extension if not exists pg_net;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

alter table public.todos
add column reminder_email_sent_at timestamptz,
add column reminder_email_attempt_count integer not null default 0,
add column reminder_email_last_error text,
add column reminder_email_claimed_at timestamptz,
add column reminder_email_claim_token uuid,
add constraint todos_reminder_email_attempt_count_nonnegative
  check (reminder_email_attempt_count >= 0);

create index todos_due_reminder_email_idx
on public.todos (reminder_time, created_at)
where reminder_time is not null
  and reminder_email_sent_at is null
  and status <> 'completed';

create or replace function public.reset_todo_reminder_email_delivery()
returns trigger
language plpgsql
as $$
begin
  if new.reminder_time is distinct from old.reminder_time then
    -- A changed reminder is a new delivery target, so stale claim/send state must not block it.
    new.reminder_email_sent_at = null;
    new.reminder_email_attempt_count = 0;
    new.reminder_email_last_error = null;
    new.reminder_email_claimed_at = null;
    new.reminder_email_claim_token = null;
  end if;

  return new;
end;
$$;

create trigger reset_todo_reminder_email_delivery
before update on public.todos
for each row
execute function public.reset_todo_reminder_email_delivery();

create or replace function public.claim_due_todo_reminder_emails(
  requested_batch_size integer default 25
)
returns table (
  id uuid,
  title text,
  progress_note text,
  status text,
  priority text,
  due_date integer,
  reminder_time integer,
  reminder_email_claim_token uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  safe_batch_size integer := least(greatest(coalesce(requested_batch_size, 25), 1), 100);
  now_epoch integer := extract(epoch from now())::integer;
begin
  return query
  with candidates as (
    select todos.id
    from public.todos
    where todos.reminder_time is not null
      and todos.reminder_time <= now_epoch
      and todos.status <> 'completed'
      and todos.reminder_email_sent_at is null
      and todos.reminder_email_attempt_count < 3
      and (
        todos.reminder_email_claimed_at is null
        or todos.reminder_email_claimed_at < now() - interval '10 minutes'
      )
    order by todos.reminder_time asc, todos.created_at asc
    limit safe_batch_size
    for update skip locked
  )
  update public.todos
  set reminder_email_claimed_at = now(),
    reminder_email_claim_token = gen_random_uuid()
  from candidates
  where todos.id = candidates.id
  returning
    todos.id,
    todos.title,
    todos.progress_note,
    todos.status,
    todos.priority,
    todos.due_date,
    todos.reminder_time,
    todos.reminder_email_claim_token;
end;
$$;

create or replace function public.mark_todo_reminder_email_sent(
  reminder_id uuid,
  claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.todos
  set reminder_email_sent_at = now(),
    reminder_email_last_error = null,
    reminder_email_claimed_at = null,
    reminder_email_claim_token = null
  where id = reminder_id
    and reminder_email_claim_token = claim_token
    and reminder_email_sent_at is null;

  return found;
end;
$$;

create or replace function public.mark_todo_reminder_email_failed(
  reminder_id uuid,
  claim_token uuid,
  error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.todos
  set reminder_email_attempt_count = reminder_email_attempt_count + 1,
    reminder_email_last_error = left(coalesce(error_message, 'Unknown reminder email error.'), 1000),
    reminder_email_claimed_at = null,
    reminder_email_claim_token = null
  where id = reminder_id
    and reminder_email_claim_token = claim_token
    and reminder_email_sent_at is null;

  return found;
end;
$$;

revoke all on function public.claim_due_todo_reminder_emails(integer) from public, anon, authenticated;
revoke all on function public.mark_todo_reminder_email_sent(uuid, uuid) from public, anon, authenticated;
revoke all on function public.mark_todo_reminder_email_failed(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.claim_due_todo_reminder_emails(integer) to service_role;
grant execute on function public.mark_todo_reminder_email_sent(uuid, uuid) to service_role;
grant execute on function public.mark_todo_reminder_email_failed(uuid, uuid, text) to service_role;

select cron.schedule(
  'send-todo-reminder-emails-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/send-todo-reminder-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer '
        || coalesce(
          (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
          (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
        )
    ),
    body := jsonb_build_object('time', now())
  ) as request_id;
  $$
);
