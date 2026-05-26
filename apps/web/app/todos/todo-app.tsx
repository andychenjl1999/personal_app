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

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState<TodoDraft>(initialDraft);
  const [error, setError] = useState('');
  const [hasLoadedTodos, setHasLoadedTodos] = useState(false);

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
          {todos.length === 0 ? (
            <p className="empty-state">No todos yet. Create one to start.</p>
          ) : (
            todos.map((todo) => (
              <article className="todo-item" key={todo.id}>
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

                <div className="todo-field-grid">
                  <label>
                    <span>Status</span>
                    <select
                      value={todo.status}
                      onChange={(event) =>
                        updateTodo(todo.id, {
                          status: event.target.value as TodoStatus,
                        })
                      }
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
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
