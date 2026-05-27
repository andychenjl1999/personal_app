import { supabase } from '../../lib/supabase/client';

export type TodoStatus = 'planned' | 'in-progress' | 'completed';
export type TodoPriority = 'low' | 'medium' | 'high';

export type Todo = {
  id: string;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate?: number;
  reminderTime?: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateTodoInput = {
  title: string;
  priority: TodoPriority;
  dueDate?: number;
  reminderTime?: number;
};

export type UpdateTodoInput = Partial<
  Pick<Todo, 'title' | 'status' | 'priority' | 'dueDate' | 'reminderTime'>
>;

type TodoRow = {
  id: string;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
  due_date: number | null;
  reminder_time: number | null;
  created_at: string;
  updated_at: string;
};

const todoColumns =
  'id,title,status,priority,due_date,reminder_time,created_at,updated_at';

function mapTodoRow(row: TodoRow): Todo {
  // Supabase returns snake_case columns; the UI keeps camelCase names so React state stays idiomatic.
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date ?? undefined,
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
    status: 'planned' satisfies TodoStatus,
    priority: input.priority,
    due_date: input.dueDate ?? null,
    reminder_time: input.reminderTime ?? null,
  };
}

function buildUpdatePayload(updates: UpdateTodoInput) {
  const payload: Partial<
    Pick<TodoRow, 'title' | 'status' | 'priority' | 'due_date' | 'reminder_time'>
  > = {};

  // Only properties explicitly present are sent, which lets blank date controls clear nullable columns.
  if ('title' in updates) {
    const title = updates.title?.trim();
    if (!title) {
      throw new Error('Todo title cannot be empty.');
    }

    payload.title = title;
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

  if ('reminderTime' in updates) {
    payload.reminder_time = updates.reminderTime ?? null;
  }

  return payload;
}

export async function listTodos(): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select(todoColumns)
    .order('created_at', { ascending: false })
    .returns<TodoRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapTodoRow);
}

export async function createTodo(input: CreateTodoInput): Promise<Todo> {
  const { data, error } = await supabase
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

export async function updateTodo(
  todoId: string,
  updates: UpdateTodoInput,
): Promise<Todo> {
  const { data, error } = await supabase
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

export async function deleteTodo(todoId: string): Promise<void> {
  const { error } = await supabase.from('todos').delete().eq('id', todoId);

  if (error) {
    throw new Error(error.message);
  }
}
