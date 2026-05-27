create extension if not exists "pgcrypto";

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'planned',
  priority text not null default 'medium',
  due_date integer,
  reminder_time integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- These checks keep database rows aligned with the UI enum values before they reach React state.
  constraint todos_title_not_blank check (length(trim(title)) > 0),
  constraint todos_status_check check (status in ('planned', 'in-progress', 'completed')),
  constraint todos_priority_check check (priority in ('low', 'medium', 'high')),
  constraint todos_due_date_positive check (due_date is null or due_date > 0),
  constraint todos_reminder_time_positive check (reminder_time is null or reminder_time > 0)
);

create index todos_created_at_idx on public.todos (created_at desc);

create function public.set_todos_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- Keep updated_at database-owned so every Supabase mutation reports the persisted update time.
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_todos_updated_at
before update on public.todos
for each row
execute function public.set_todos_updated_at();

alter table public.todos enable row level security;

-- Temporary no-auth policy for the current single-user phase; replace this with owner-scoped policies when auth lands.
create policy "Allow anon todo reads"
on public.todos
for select
to anon
using (true);

-- Temporary no-auth policy for browser inserts while the app has no signed-in user identity.
create policy "Allow anon todo inserts"
on public.todos
for insert
to anon
with check (true);

-- Temporary no-auth policy for browser edits while there is no per-user ownership column to enforce.
create policy "Allow anon todo updates"
on public.todos
for update
to anon
using (true)
with check (true);

-- Temporary no-auth policy kept ready for full data-layer CRUD, even though the first UI has no delete control.
create policy "Allow anon todo deletes"
on public.todos
for delete
to anon
using (true);
