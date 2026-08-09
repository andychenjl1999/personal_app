create function public.create_todo_at_daily_position(
  p_title text,
  p_progress_note text,
  p_status text,
  p_priority text,
  p_due_date integer,
  p_execution_time text,
  p_reminder_time integer,
  p_destination_order integer
)
returns public.todos
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  created_todo public.todos;
begin
  if nullif(trim(p_title), '') is null then
    raise exception 'Add a title before creating a todo.';
  end if;

  if p_due_date is null or p_due_date <= 0 then
    raise exception 'Execution date must be a positive Unix timestamp.';
  end if;

  if p_destination_order is null or p_destination_order <= 0 then
    raise exception 'Daily execution order must be a positive integer.';
  end if;

  -- Creation and positional ranking share this RPC transaction. If ranking fails, the insert
  -- rolls back too, so retrying the modal cannot leave a duplicate appended todo behind.
  insert into public.todos (
    title,
    progress_note,
    status,
    priority,
    due_date,
    execution_time,
    reminder_time
  )
  values (
    trim(p_title),
    trim(coalesce(p_progress_note, '')),
    coalesce(p_status, 'planned'),
    coalesce(p_priority, 'medium'),
    p_due_date,
    nullif(trim(coalesce(p_execution_time, '')), ''),
    p_reminder_time
  )
  returning * into created_todo;

  perform public.move_todo_to_daily_position(
    created_todo.id,
    p_due_date,
    p_destination_order
  );

  -- Re-read the row after ranking so the browser receives the final order and updated_at.
  select todo.*
  into created_todo
  from public.todos as todo
  where todo.id = created_todo.id;

  return created_todo;
end;
$$;

revoke all on function public.create_todo_at_daily_position(
  text,
  text,
  text,
  text,
  integer,
  text,
  integer,
  integer
) from public;

grant execute on function public.create_todo_at_daily_position(
  text,
  text,
  text,
  text,
  integer,
  text,
  integer,
  integer
) to anon;
