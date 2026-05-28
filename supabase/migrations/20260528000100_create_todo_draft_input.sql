create table public.todo_draft_input (
  id smallint primary key default 1,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- This table is a singleton scratchpad: one saved string can contain many rough todo lines.
  constraint todo_draft_input_singleton check (id = 1)
);

create function public.set_todo_draft_input_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- Keep updated_at database-owned so saves from any client report the persisted update time.
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_todo_draft_input_updated_at
before update on public.todo_draft_input
for each row
execute function public.set_todo_draft_input_updated_at();

alter table public.todo_draft_input enable row level security;

-- Temporary no-auth policy for the current single-user phase; replace this with owner-scoped policies when auth lands.
create policy "Allow anon todo draft reads"
on public.todo_draft_input
for select
to anon
using (true);

-- Temporary no-auth policy for browser inserts while the app has no signed-in user identity.
create policy "Allow anon todo draft inserts"
on public.todo_draft_input
for insert
to anon
with check (true);

-- Temporary no-auth policy for browser edits while there is no per-user ownership column to enforce.
create policy "Allow anon todo draft updates"
on public.todo_draft_input
for update
to anon
using (true)
with check (true);
