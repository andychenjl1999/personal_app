import { getSupabaseClient } from '../../lib/supabase/client';

export type TodoStatus = 'planned' | 'in-progress' | 'completed';
export type TodoPriority = 'low' | 'medium' | 'high';

export type Todo = {
  id: string;
  title: string;
  progressNote: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate?: number;
  executionTime?: string;
  dailyExecutionOrder?: number;
  reminderTime?: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateTodoInput = Pick<Todo, 'title'> &
  Partial<
    Pick<
      Todo,
      | 'progressNote'
      | 'status'
      | 'priority'
      | 'dueDate'
      | 'executionTime'
      | 'reminderTime'
    >
  >;

export type TodoListOptions = {
  includeCompleted?: boolean;
};

export type UpdateTodoInput = Partial<
  Pick<
    Todo,
    | 'title'
    | 'progressNote'
    | 'status'
    | 'priority'
    | 'dueDate'
    | 'executionTime'
    | 'reminderTime'
  >
>;

export type MoveTodoToDailyPositionInput = {
  todoId: string;
  destinationDueDate?: number;
  destinationOrder?: number;
};

type TodoRow = {
  id: string;
  title: string;
  progress_note: string;
  status: TodoStatus;
  priority: TodoPriority;
  due_date: number | null;
  execution_time: string | null;
  daily_execution_order: number | null;
  reminder_time: number | null;
  created_at: string;
  updated_at: string;
};

const todoColumns =
  'id,title,progress_note,status,priority,due_date,execution_time,daily_execution_order,reminder_time,created_at,updated_at';

function mapTodoRow(row: TodoRow): Todo {
  // Supabase returns snake_case columns; the UI keeps camelCase names so React state stays idiomatic.
  return {
    id: row.id,
    title: row.title,
    progressNote: row.progress_note,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date ?? undefined,
    executionTime: row.execution_time ?? undefined,
    dailyExecutionOrder: row.daily_execution_order ?? undefined,
    reminderTime: row.reminder_time ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildCreatePayload(input: CreateTodoInput) {
  const title = input.title.trim();
  if (!title) {
    throw new Error('Add a title before creating a todo.');
  }

  // The insert payload mirrors the database column names and lets Supabase own id and timestamps.
  return {
    title,
    progress_note: input.progressNote?.trim() ?? '',
    status: input.status ?? ('planned' satisfies TodoStatus),
    priority: input.priority ?? ('medium' satisfies TodoPriority),
    due_date: input.dueDate ?? null,
    execution_time: input.executionTime?.trim() || null,
    reminder_time: input.reminderTime ?? null,
  };
}

function buildTitleOnlyCreatePayloads(titles: string[]) {
  const payloads = titles
    .map((title) => title.trim())
    .filter((title) => title.length > 0)
    .map((title) => ({ title }));

  if (payloads.length === 0) {
    throw new Error('Add at least one draft todo line before converting.');
  }

  return payloads;
}

function buildUpdatePayload(updates: UpdateTodoInput) {
  const payload: Partial<
    Pick<
      TodoRow,
      | 'title'
      | 'progress_note'
      | 'status'
      | 'priority'
      | 'due_date'
      | 'execution_time'
      | 'reminder_time'
    >
  > = {};

  // Only properties explicitly present are sent, which lets blank date controls clear nullable columns.
  if ('title' in updates) {
    const title = updates.title?.trim();
    if (!title) {
      throw new Error('Todo title cannot be empty.');
    }

    payload.title = title;
  }

  if ('progressNote' in updates) {
    payload.progress_note = updates.progressNote ?? '';
  }

  if ('status' in updates) {
    payload.status = updates.status;
  }

  if ('priority' in updates) {
    payload.priority = updates.priority;
  }

  if ('dueDate' in updates) {
    payload.due_date = updates.dueDate ?? null;
  }

  if ('executionTime' in updates) {
    payload.execution_time = updates.executionTime?.trim() || null;
  }

  if ('reminderTime' in updates) {
    payload.reminder_time = updates.reminderTime ?? null;
  }

  return payload;
}

export async function listTodos(
  options: TodoListOptions = {},
): Promise<Todo[]> {
  let query = getSupabaseClient().from('todos').select(todoColumns);

  if (!options.includeCompleted) {
    query = query.neq('status', 'completed');
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .returns<TodoRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapTodoRow);
}

export async function createTodo(input: CreateTodoInput): Promise<Todo> {
  const { data, error } = await getSupabaseClient()
    .from('todos')
    .insert(buildCreatePayload(input))
    .select(todoColumns)
    .single<TodoRow>();

  if (error) {
    throw new Error(error.message);
  }

  // Mutations select the saved row so local state reflects database defaults, triggers, and constraints.
  return mapTodoRow(data);
}

export async function createTodos(inputs: CreateTodoInput[]): Promise<Todo[]> {
  if (inputs.length === 0) {
    throw new Error('Add at least one todo before creating the batch.');
  }

  // Supabase sends this array as one insert statement. Validation or trigger failures roll
  // back the entire recurrence instead of leaving a partially created set of independent rows.
  const { data, error } = await getSupabaseClient()
    .from('todos')
    .insert(inputs.map(buildCreatePayload))
    .select(todoColumns)
    .returns<TodoRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapTodoRow);
}

export async function createTodoAtDailyPosition(
  input: CreateTodoInput,
  destinationOrder: number,
): Promise<Todo> {
  const payload = buildCreatePayload(input);
  if (payload.due_date === null) {
    throw new Error('Choose an execution date before positioning this todo.');
  }

  const { data, error } = await getSupabaseClient()
    .rpc('create_todo_at_daily_position', {
      p_title: payload.title,
      p_progress_note: payload.progress_note,
      p_status: payload.status,
      p_priority: payload.priority,
      p_due_date: payload.due_date,
      p_execution_time: payload.execution_time,
      p_reminder_time: payload.reminder_time,
      p_destination_order: destinationOrder,
    })
    .single<TodoRow>();

  if (error) {
    throw new Error(error.message);
  }

  // A composite RPC result has the same snake_case row shape as table mutations.
  return mapTodoRow(data);
}

export async function createTodosFromTitles(titles: string[]): Promise<Todo[]> {
  const { data, error } = await getSupabaseClient()
    .from('todos')
    .insert(buildTitleOnlyCreatePayloads(titles))
    .select(todoColumns)
    .returns<TodoRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  // Draft conversion intentionally sends only titles; the returned rows include database-owned defaults.
  return data.map(mapTodoRow);
}

export async function updateTodo(
  todoId: string,
  updates: UpdateTodoInput,
): Promise<Todo> {
  const { data, error } = await getSupabaseClient()
    .from('todos')
    .update(buildUpdatePayload(updates))
    .eq('id', todoId)
    .select(todoColumns)
    .single<TodoRow>();

  if (error) {
    throw new Error(error.message);
  }

  // Returning the selected row keeps optimistic UI state aligned with persisted Supabase values.
  return mapTodoRow(data);
}

export async function moveTodoToDailyPosition({
  todoId,
  destinationDueDate,
  destinationOrder,
}: MoveTodoToDailyPositionInput): Promise<Todo[]> {
  const { data, error } = await getSupabaseClient().rpc(
    'move_todo_to_daily_position',
    {
      p_todo_id: todoId,
      p_destination_due_date: destinationDueDate ?? null,
      p_destination_order: destinationOrder ?? null,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  // The RPC returns every row whose date or order changed so optimistic state can be
  // reconciled without reloading the full calendar after every drag.
  return (data as unknown as TodoRow[]).map(mapTodoRow);
}

export async function deleteTodo(todoId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('todos')
    .delete()
    .eq('id', todoId);

  if (error) {
    throw new Error(error.message);
  }
}
