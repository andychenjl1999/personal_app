-- Daily execution order belongs only to visible, active todos that have an execution date.
update public.todos
set daily_execution_order = null
where due_date is null
   or status = 'completed';

-- Preserve existing valid relative order where possible, then deterministically place legacy
-- unassigned rows using the calendar's previous newest-first display order.
with ranked_todos as (
  select
    id,
    row_number() over (
      partition by due_date
      order by daily_execution_order asc nulls last, created_at desc, id asc
    )::integer as normalized_order
  from public.todos
  where due_date is not null
    and status <> 'completed'
)
update public.todos as todo
set daily_execution_order = ranked_todos.normalized_order
from ranked_todos
where todo.id = ranked_todos.id;

alter table public.todos
add constraint todos_daily_execution_order_positive
check (daily_execution_order is null or daily_execution_order > 0),
add constraint todos_daily_execution_order_scope
check (
  (
    due_date is not null
    and status <> 'completed'
    and daily_execution_order is not null
  )
  or (
    (due_date is null or status = 'completed')
    and daily_execution_order is null
  )
),
add constraint todos_daily_execution_order_unique
unique (due_date, daily_execution_order)
deferrable initially deferred;

comment on column public.todos.daily_execution_order is
  'One-based contiguous order for active todos within an execution date; null for unscheduled or completed todos.';

create function public.normalize_todo_daily_execution_orders(p_due_dates integer[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_due_dates is null or cardinality(p_due_dates) = 0 then
    return;
  end if;

  -- Renumber every affected day in one statement so the deferred unique constraint never
  -- exposes a partially shifted list at transaction commit.
  with ranked_todos as (
    select
      id,
      row_number() over (
        partition by due_date
        order by daily_execution_order asc, created_at desc, id asc
      )::integer as normalized_order
    from public.todos
    where status <> 'completed'
      and due_date = any(p_due_dates)
  )
  update public.todos as todo
  set daily_execution_order = ranked_todos.normalized_order
  from ranked_todos
  where todo.id = ranked_todos.id
    and todo.daily_execution_order is distinct from ranked_todos.normalized_order;
end;
$$;

revoke all on function public.normalize_todo_daily_execution_orders(integer[]) from public;

create function public.prepare_todo_daily_execution_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  should_append boolean := tg_op = 'INSERT';
begin
  if new.due_date is null or new.status = 'completed' then
    new.daily_execution_order = null;
    return new;
  end if;

  -- Newly scheduled or reactivated todos always enter at the bottom. Explicit positional
  -- moves are applied afterward by move_todo_to_daily_position within the same transaction.
  if tg_op = 'UPDATE' then
    should_append =
      old.due_date is distinct from new.due_date
      or old.status = 'completed';
  end if;

  if should_append then
    select coalesce(max(todo.daily_execution_order), 0) + 1
    into new.daily_execution_order
    from public.todos as todo
    where todo.due_date = new.due_date
      and todo.status <> 'completed'
      and todo.id <> new.id;
  elsif new.daily_execution_order is null then
    -- Daily order is database-owned. Older clients that still submit null must not erase
    -- a valid position when the todo remains active on the same day.
    new.daily_execution_order = old.daily_execution_order;
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_todo_daily_execution_order() from public;

create trigger prepare_todo_daily_execution_order
before insert or update of due_date, status, daily_execution_order
on public.todos
for each row
execute function public.prepare_todo_daily_execution_order();

create function public.normalize_arriving_todo_daily_execution_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  should_normalize boolean := tg_op = 'INSERT';
begin
  if new.due_date is null or new.status = 'completed' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    should_normalize =
      old.due_date is distinct from new.due_date
      or old.status = 'completed';
  end if;

  if should_normalize then
    -- Multi-row inserts and batch date updates can temporarily choose the same append value.
    -- The deferred unique constraint permits that transient state while this trigger ranks it.
    perform public.normalize_todo_daily_execution_orders(array[new.due_date]);
  end if;

  return null;
end;
$$;

revoke all on function public.normalize_arriving_todo_daily_execution_order() from public;

create trigger normalize_arriving_todo_daily_execution_order
after insert or update of due_date, status
on public.todos
for each row
execute function public.normalize_arriving_todo_daily_execution_order();

create function public.compact_departed_todo_daily_execution_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.due_date is not null and old.status <> 'completed' then
      perform public.normalize_todo_daily_execution_orders(array[old.due_date]);
    end if;

    return null;
  end if;

  if old.due_date is not null
    and old.status <> 'completed'
    and (
      new.due_date is distinct from old.due_date
      or new.status = 'completed'
    ) then
    perform public.normalize_todo_daily_execution_orders(array[old.due_date]);
  end if;

  return null;
end;
$$;

revoke all on function public.compact_departed_todo_daily_execution_order() from public;

create trigger compact_departed_todo_daily_execution_order
after update of due_date, status or delete
on public.todos
for each row
execute function public.compact_departed_todo_daily_execution_order();

create function public.move_todo_to_daily_position(
  p_todo_id uuid,
  p_destination_due_date integer default null,
  p_destination_order integer default null
)
returns setof public.todos
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  source_due_date integer;
  source_status text;
  destination_count integer;
  target_order integer;
begin
  if p_destination_due_date is not null and p_destination_due_date <= 0 then
    raise exception 'Execution date must be a positive Unix timestamp.';
  end if;

  if p_destination_order is not null and p_destination_order <= 0 then
    raise exception 'Daily execution order must be a positive integer.';
  end if;

  select todo.due_date, todo.status
  into source_due_date, source_status
  from public.todos as todo
  where todo.id = p_todo_id
  for update;

  if not found then
    raise exception 'Todo % was not found.', p_todo_id;
  end if;

  if source_status = 'completed' then
    raise exception 'Completed todos cannot be moved.';
  end if;

  -- Lock both affected lists before changing either one. The trigger compacts the source
  -- immediately when the date changes, and the destination is ranked below.
  perform todo.id
  from public.todos as todo
  where todo.status <> 'completed'
    and (
      todo.due_date = source_due_date
      or todo.due_date = p_destination_due_date
    )
  order by todo.id
  for update;

  if source_due_date is distinct from p_destination_due_date then
    update public.todos
    set due_date = p_destination_due_date
    where id = p_todo_id;
  end if;

  if p_destination_due_date is not null then
    select count(*)::integer
    into destination_count
    from public.todos as todo
    where todo.due_date = p_destination_due_date
      and todo.status <> 'completed';

    -- Month and blank-space drops omit a position and append. Row-level daily drops provide
    -- a one-based position, which is clamped so stale clients cannot create gaps.
    target_order = case
      when p_destination_order is null then destination_count
      else least(greatest(p_destination_order, 1), destination_count)
    end;

    with remaining_todos as (
      select
        todo.id,
        row_number() over (
          order by todo.daily_execution_order asc, todo.created_at desc, todo.id asc
        )::integer as order_without_moved_todo
      from public.todos as todo
      where todo.due_date = p_destination_due_date
        and todo.status <> 'completed'
        and todo.id <> p_todo_id
    ), desired_orders as (
      select
        remaining_todos.id,
        remaining_todos.order_without_moved_todo
          + case
              when remaining_todos.order_without_moved_todo >= target_order then 1
              else 0
            end as daily_execution_order
      from remaining_todos

      union all

      select p_todo_id, target_order
    )
    update public.todos as todo
    set daily_execution_order = desired_orders.daily_execution_order
    from desired_orders
    where todo.id = desired_orders.id
      and todo.daily_execution_order is distinct from desired_orders.daily_execution_order;
  end if;

  return query
  select todo.*
  from public.todos as todo
  where todo.id = p_todo_id
    or (
      todo.status <> 'completed'
      and (
        todo.due_date = source_due_date
        or todo.due_date = p_destination_due_date
      )
    );
end;
$$;

revoke all on function public.move_todo_to_daily_position(uuid, integer, integer) from public;
grant execute on function public.move_todo_to_daily_position(uuid, integer, integer) to anon;

-- The rollover can move several rows onto today in one statement. The row trigger appends
-- each todo, and this final normalization guarantees a contiguous destination after the batch.
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
  if extract(hour from local_now) <> 5 then
    return 0;
  end if;

  insert into public.todo_due_date_rollover_runs (local_date)
  values (local_today)
  on conflict (local_date) do nothing;

  if not found then
    return 0;
  end if;

  update public.todos
  set due_date = today_due_date
  where status <> 'completed'
    and due_date is not null
    and due_date < today_due_date;

  get diagnostics rollover_count = row_count;

  perform public.normalize_todo_daily_execution_orders(array[today_due_date]);

  update public.todo_due_date_rollover_runs
  set updated_count = rollover_count
  where local_date = local_today;

  return rollover_count;
end;
$$;
