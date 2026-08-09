alter table public.todos
add column execution_time text,
add column daily_execution_order integer;

comment on column public.todos.execution_time is
  'Optional local time of day formatted as hh:mm am/pm.';

comment on column public.todos.daily_execution_order is
  'Optional integer reserved for ordering todos within an execution date.';
