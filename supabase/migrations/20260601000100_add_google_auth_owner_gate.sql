create table public.app_owner (
  id boolean primary key default true,
  user_id uuid not null unique references auth.users(id) on delete restrict,
  email text,
  claimed_at timestamptz not null default now(),

  -- The app is intentionally single-owner for the personal-app phase.
  constraint app_owner_singleton check (id)
);

alter table public.app_owner enable row level security;

create policy "Allow owner app owner reads"
on public.app_owner
for select
to authenticated
using (user_id = auth.uid());

alter table public.todos
add column owner_user_id uuid references auth.users(id) on delete restrict;

alter table public.todo_draft_input
add column owner_user_id uuid references auth.users(id) on delete restrict;

create function public.set_todos_owner_user_id()
returns trigger
language plpgsql
as $$
begin
  -- Browser inserts do not send ownership; the authenticated JWT owns each new row.
  if auth.uid() is null then
    raise exception 'Authentication is required to create todos.';
  end if;

  if new.owner_user_id is null then
    new.owner_user_id := auth.uid();
  end if;

  if new.owner_user_id <> auth.uid() then
    raise exception 'Todos can only be created for the signed-in owner.';
  end if;

  return new;
end;
$$;

create trigger set_todos_owner_user_id
before insert on public.todos
for each row
execute function public.set_todos_owner_user_id();

create function public.set_todo_draft_input_owner_user_id()
returns trigger
language plpgsql
as $$
begin
  -- The singleton draft row is still owned by the signed-in personal account.
  if auth.uid() is null then
    raise exception 'Authentication is required to save draft todos.';
  end if;

  if new.owner_user_id is null then
    new.owner_user_id := auth.uid();
  end if;

  if new.owner_user_id <> auth.uid() then
    raise exception 'Draft todos can only be saved for the signed-in owner.';
  end if;

  return new;
end;
$$;

create trigger set_todo_draft_input_owner_user_id
before insert on public.todo_draft_input
for each row
execute function public.set_todo_draft_input_owner_user_id();

create function public.claim_personal_app_owner()
returns table (
  owner_user_id uuid,
  owner_email text,
  owner_claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  owner_record public.app_owner%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to claim this app.'
      using errcode = '42501';
  end if;

  select users.email
  into current_user_email
  from auth.users
  where users.id = current_user_id;

  -- The first authenticated account becomes the durable app owner.
  insert into public.app_owner (id, user_id, email)
  values (true, current_user_id, current_user_email)
  on conflict (id) do nothing;

  select *
  into owner_record
  from public.app_owner
  where id = true;

  if owner_record.user_id <> current_user_id then
    raise exception 'This personal app is already claimed by another account.'
      using errcode = '42501';
  end if;

  -- Existing no-auth rows become the first owner's personal dataset.
  update public.todos
  set owner_user_id = current_user_id
  where owner_user_id is null;

  update public.todo_draft_input
  set owner_user_id = current_user_id
  where owner_user_id is null;

  return query
  select
    owner_record.user_id,
    owner_record.email,
    owner_record.claimed_at;
end;
$$;

revoke all on function public.claim_personal_app_owner() from public;
grant execute on function public.claim_personal_app_owner() to authenticated;

drop policy if exists "Allow anon todo reads" on public.todos;
drop policy if exists "Allow anon todo inserts" on public.todos;
drop policy if exists "Allow anon todo updates" on public.todos;
drop policy if exists "Allow anon todo deletes" on public.todos;

create policy "Allow owner todo reads"
on public.todos
for select
to authenticated
using (owner_user_id = auth.uid());

create policy "Allow owner todo inserts"
on public.todos
for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy "Allow owner todo updates"
on public.todos
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "Allow owner todo deletes"
on public.todos
for delete
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "Allow anon todo draft reads" on public.todo_draft_input;
drop policy if exists "Allow anon todo draft inserts" on public.todo_draft_input;
drop policy if exists "Allow anon todo draft updates" on public.todo_draft_input;

create policy "Allow owner todo draft reads"
on public.todo_draft_input
for select
to authenticated
using (owner_user_id = auth.uid());

create policy "Allow owner todo draft inserts"
on public.todo_draft_input
for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy "Allow owner todo draft updates"
on public.todo_draft_input
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());
