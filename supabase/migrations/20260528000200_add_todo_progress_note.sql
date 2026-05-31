alter table public.todos
add column progress_note text not null default '';
