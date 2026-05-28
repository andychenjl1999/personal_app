create extension if not exists pg_cron;

create table public.todo_due_date_rollover_runs (
  local_date date primary key,
  ran_at timestamptz not null default now(),
  updated_count integer not null default 0,

  constraint todo_due_date_rollover_runs_updated_count_nonnegative check (updated_count >= 0)
);

alter table public.todo_due_date_rollover_runs enable row level security;

create or replace function public.roll_over_overdue_todos()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  local_timezone constant text := 'America/Los_Angeles';
  local_now timestamp := now() at time zone local_timezone;
  local_today date := local_now::date;
  today_due_date integer := extract(
    epoch from (local_today::timestamp at time zone local_timezone)
  )::integer;
  rollover_count integer := 0;
begin
  -- Two UTC cron entries cover Pacific daylight and standard time; this guard keeps only the true 5am local run active.
  if extract(hour from local_now) <> 5 then
    return 0;
  end if;

  -- The date log makes the rollover idempotent if the function is invoked more than once for the same Pacific day.
  insert into public.todo_due_date_rollover_runs (local_date)
  values (local_today)
  on conflict (local_date) do nothing;

  if not found then
    return 0;
  end if;

  -- Due dates are stored as Unix seconds for local midnight, so overdue active items move to today's local midnight.
  update public.todos
  set due_date = today_due_date
  where status <> 'completed'
    and due_date is not null
    and due_date < today_due_date;

  get diagnostics rollover_count = row_count;

  update public.todo_due_date_rollover_runs
  set updated_count = rollover_count
  where local_date = local_today;

  return rollover_count;
end;
$$;

select cron.schedule(
  'roll-over-overdue-todos-pacific-daylight',
  '0 12 * * *',
  $$select public.roll_over_overdue_todos();$$
);

select cron.schedule(
  'roll-over-overdue-todos-pacific-standard',
  '0 13 * * *',
  $$select public.roll_over_overdue_todos();$$
);
