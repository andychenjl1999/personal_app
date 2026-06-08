create table public.daily_todo_planner_items (
  id uuid primary key default gen_random_uuid(),
  position integer not null,
  completed boolean not null default false,
  start_time text not null default '',
  end_time text not null default '',
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Positions are rewritten as a contiguous zero-based list after reorder and delete operations.
  constraint daily_todo_planner_items_position_check check (position >= 0)
);

create index daily_todo_planner_items_position_idx
on public.daily_todo_planner_items (position asc, created_at asc);

create function public.set_daily_todo_planner_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_daily_todo_planner_items_updated_at
before update on public.daily_todo_planner_items
for each row
execute function public.set_daily_todo_planner_items_updated_at();

alter table public.daily_todo_planner_items enable row level security;

-- Temporary no-auth policy for the current single-user phase; replace this with owner-scoped policies when auth lands.
create policy "Allow anon daily planner reads"
on public.daily_todo_planner_items
for select
to anon
using (true);

-- Temporary no-auth policy for browser inserts while the app has no signed-in user identity.
create policy "Allow anon daily planner inserts"
on public.daily_todo_planner_items
for insert
to anon
with check (true);

-- Temporary no-auth policy for browser edits while there is no per-user ownership column to enforce.
create policy "Allow anon daily planner updates"
on public.daily_todo_planner_items
for update
to anon
using (true)
with check (true);

-- Temporary no-auth policy for deleting planner rows while the app has no signed-in user identity.
create policy "Allow anon daily planner deletes"
on public.daily_todo_planner_items
for delete
to anon
using (true);
