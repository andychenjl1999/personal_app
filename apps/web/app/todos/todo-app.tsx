'use client';

import { FormEvent, useEffect, useState } from 'react';

type TodoStatus = 'planned' | 'in-progress' | 'completed';
type TodoPriority = 'low' | 'medium' | 'high';

type Todo = {
  id: string;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate?: string;
  reminderTime?: string;
  createdAt: string;
};

type TodoDraft = {
  title: string;
  priority: TodoPriority;
  dueDate: string;
  reminderTime: string;
};

type SortField = 'createdAt' | 'name' | 'priority' | 'dueDate' | 'reminderTime' | 'status';
type SortDirection = 'asc' | 'desc';

const initialDraft: TodoDraft = {
  title: '',
  priority: 'medium',
  dueDate: '',
  reminderTime: '',
};

const storageKey = 'personal-app-v2.todos';

const statusLabels: Record<TodoStatus, string> = {
  planned: 'Planned',
  'in-progress': 'In progress',
  completed: 'Completed',
};

const priorityLabels: Record<TodoPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const priorityRank: Record<TodoPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const statusRank: Record<TodoStatus, number> = {
  planned: 1,
  'in-progress': 2,
  completed: 3,
};

const sortLabels: Record<SortField, string> = {
  createdAt: 'Created',
  name: 'Name',
  priority: 'Priority',
  dueDate: 'Due date',
  reminderTime: 'Reminder time',
  status: 'Status',
};

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState<TodoDraft>(initialDraft);
  const [error, setError] = useState('');
  const [hasLoadedTodos, setHasLoadedTodos] = useState(false);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    // Loading happens after hydration so browser storage is only touched on the client.
    const rawTodos = window.localStorage.getItem(storageKey);
    if (!rawTodos) {
      setHasLoadedTodos(true);
      return;
    }

    try {
      const parsedTodos = JSON.parse(rawTodos) as Todo[];
      setTodos(Array.isArray(parsedTodos) ? parsedTodos : []);
    } catch {
      setTodos([]);
    } finally {
      setHasLoadedTodos(true);
    }
  }, []);

  useEffect(() => {
    // The load guard prevents the empty initial render from overwriting existing saved todos.
    if (!hasLoadedTodos) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(todos));
  }, [hasLoadedTodos, todos]);

  function handleCreateTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // The title is the only free-text identity for a todo, so block empty items before they enter the list.
    const title = draft.title.trim();
    if (!title) {
      setError('Add a title before creating a todo.');
      return;
    }

    // New todos always start in the planned lane; later chunks add editing and persistence around this shape.
    const todo: Todo = {
      id: crypto.randomUUID(),
      title,
      status: 'planned',
      priority: draft.priority,
      dueDate: draft.dueDate || undefined,
      reminderTime: draft.reminderTime || undefined,
      createdAt: new Date().toISOString(),
    };

    setTodos((currentTodos) => [todo, ...currentTodos]);
    setDraft(initialDraft);
    setError('');
  }

  function updateTodo(todoId: string, updates: Partial<Todo>) {
    // Field edits are stored as partial todo updates so each control can remain small and direct.
    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === todoId ? { ...todo, ...updates } : todo,
      ),
    );
  }

  function completeTodo(todoId: string) {
    // Completion is intentionally one-way in this version so a checked item cannot drift back into active work accidentally.
    updateTodo(todoId, { status: 'completed' });
  }

  function compareOptionalValues(left?: string, right?: string) {
    // Blank due dates and reminder times sort after populated values in ascending order; direction reversal handles descending.
    if (!left && !right) {
      return 0;
    }

    if (!left) {
      return 1;
    }

    if (!right) {
      return -1;
    }

    return left.localeCompare(right);
  }

  function compareTodos(left: Todo, right: Todo) {
    // Each sort field maps to the same ordered comparison contract before the selected direction is applied.
    const directionMultiplier = sortDirection === 'asc' ? 1 : -1;
    let result = 0;

    if (sortField === 'name') {
      result = left.title.localeCompare(right.title);
    }

    if (sortField === 'priority') {
      result = priorityRank[left.priority] - priorityRank[right.priority];
    }

    if (sortField === 'dueDate') {
      result = compareOptionalValues(left.dueDate, right.dueDate);
    }

    if (sortField === 'reminderTime') {
      result = compareOptionalValues(left.reminderTime, right.reminderTime);
    }

    if (sortField === 'status') {
      result = statusRank[left.status] - statusRank[right.status];
    }

    if (sortField === 'createdAt') {
      result = left.createdAt.localeCompare(right.createdAt);
    }

    return result * directionMultiplier;
  }

  const sortedTodos = [...todos].sort(compareTodos);

  return (
    <main className="todo-shell">
      <section className="todo-header">
        <div>
          <p className="eyebrow">Personal App v2</p>
          <h1>Todo list</h1>
        </div>
        <p>
          Capture personal tasks, keep the workflow simple, and use this first
          feature to prove the web app experience before backend sync.
        </p>
      </section>

      <section className="todo-workspace" aria-label="Todo workspace">
        <form className="todo-form" onSubmit={handleCreateTodo}>
          <label>
            <span>Title</span>
            <input
              type="text"
              value={draft.title}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  title: event.target.value,
                }))
              }
              placeholder="Plan the next app feature"
            />
          </label>

          <label>
            <span>Priority</span>
            <select
              value={draft.priority}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  priority: event.target.value as TodoPriority,
                }))
              }
            >
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Due date</span>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  dueDate: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>Reminder time</span>
            <input
              type="time"
              value={draft.reminderTime}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  reminderTime: event.target.value,
                }))
              }
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit">Create todo</button>
        </form>

        <div className="todo-list" aria-live="polite">
          <div className="list-toolbar">
            <label>
              <span>Sort by</span>
              <select
                value={sortField}
                onChange={(event) =>
                  setSortField(event.target.value as SortField)
                }
              >
                {Object.entries(sortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() =>
                setSortDirection((currentDirection) =>
                  currentDirection === 'asc' ? 'desc' : 'asc',
                )
              }
            >
              {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            </button>
          </div>

          {todos.length === 0 ? (
            <p className="empty-state">No todos yet. Create one to start.</p>
          ) : (
            sortedTodos.map((todo) => (
              <article className="todo-item" key={todo.id}>
                <div className="todo-title-row">
                  <label className="complete-control">
                    <input
                      type="checkbox"
                      checked={todo.status === 'completed'}
                      disabled={todo.status === 'completed'}
                      onChange={() => completeTodo(todo.id)}
                    />
                    <span>Complete</span>
                  </label>

                  <label className="todo-title-field">
                    <span>Title</span>
                    <input
                      type="text"
                      value={todo.title}
                      onChange={(event) =>
                        updateTodo(todo.id, { title: event.target.value })
                      }
                      onBlur={(event) =>
                        updateTodo(todo.id, {
                          title: event.target.value.trim() || todo.title,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="todo-field-grid">
                  <label>
                    <span>Status</span>
                    <select
                      value={todo.status}
                      disabled={todo.status === 'completed'}
                      onChange={(event) =>
                        updateTodo(todo.id, {
                          status: event.target.value as TodoStatus,
                        })
                      }
                    >
                      <option value="planned">Planned</option>
                      <option value="in-progress">In progress</option>
                      {todo.status === 'completed' ? (
                        <option value="completed">Completed</option>
                      ) : null}
                    </select>
                  </label>

                  <label>
                    <span>Priority</span>
                    <select
                      value={todo.priority}
                      onChange={(event) =>
                        updateTodo(todo.id, {
                          priority: event.target.value as TodoPriority,
                        })
                      }
                    >
                      {Object.entries(priorityLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Due date</span>
                    <input
                      type="date"
                      value={todo.dueDate ?? ''}
                      onChange={(event) =>
                        updateTodo(todo.id, {
                          dueDate: event.target.value || undefined,
                        })
                      }
                    />
                  </label>

                  <label>
                    <span>Reminder</span>
                    <input
                      type="time"
                      value={todo.reminderTime ?? ''}
                      onChange={(event) =>
                        updateTodo(todo.id, {
                          reminderTime: event.target.value || undefined,
                        })
                      }
                    />
                  </label>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
