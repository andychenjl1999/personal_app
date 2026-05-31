'use client';

import { CSSProperties, FormEvent, useEffect, useState } from 'react';

import { getTodoDraftInput, saveTodoDraftInput } from './todo-draft-data';
import {
  createTodo as createSupabaseTodo,
  listTodos,
  Todo,
  TodoPriority,
  TodoStatus,
  UpdateTodoInput,
  updateTodo as updateSupabaseTodo,
} from './todo-data';

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

type FieldTone = {
  color: string;
  background: string;
};

type FieldToneStyle = CSSProperties & {
  '--field-color': string;
  '--field-bg': string;
};

const statusTones: Record<TodoStatus, FieldTone> = {
  planned: {
    color: '#2563EB',
    background: '#EFF6FF',
  },
  'in-progress': {
    color: '#D97706',
    background: '#FFFBEB',
  },
  completed: {
    color: '#16A34A',
    background: '#F0FDF4',
  },
};

const priorityTones: Record<TodoPriority, FieldTone> = {
  low: {
    color: '#6B7280',
    background: '#F3F4F6',
  },
  medium: {
    color: '#D97706',
    background: '#FFFBEB',
  },
  high: {
    color: '#DC2626',
    background: '#FEF2F2',
  },
};

function getFieldToneStyle(tone: FieldTone): FieldToneStyle {
  return {
    '--field-color': tone.color,
    '--field-bg': tone.background,
  };
}

function getOptionToneStyle(tone: FieldTone): CSSProperties {
  return {
    backgroundColor: tone.background,
    color: tone.color,
    fontWeight: 700,
  };
}

function unixSecondsToDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000);
}

function dateInputToLocalMidnightUnixSeconds(value: string) {
  // Date inputs are date-only values; construct with local components so the stored timestamp is local midnight.
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return undefined;
  }

  return Math.floor(
    new Date(year, month - 1, day, 0, 0, 0, 0).getTime() / 1000,
  );
}

function datetimeLocalInputToUnixSeconds(value: string) {
  // `datetime-local` omits timezone information, so parse the parts manually as local wall-clock time.
  if (!value) {
    return undefined;
  }

  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return undefined;
  }

  return Math.floor(
    new Date(year, month - 1, day, hour, minute, 0, 0).getTime() / 1000,
  );
}

function unixSecondsToDateInput(value?: number) {
  if (value === undefined) {
    return '';
  }

  const date = unixSecondsToDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function unixSecondsToDatetimeLocalInput(value?: number) {
  if (value === undefined) {
    return '';
  }

  const date = unixSecondsToDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function fitTextareaToContent(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return;
  }

  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState<TodoDraft>(initialDraft);
  const [draftInputContent, setDraftInputContent] = useState('');
  const [draftInputSavedAt, setDraftInputSavedAt] = useState<string>();
  const [error, setError] = useState('');
  const [draftInputLoadError, setDraftInputLoadError] = useState('');
  const [draftInputSaveError, setDraftInputSaveError] = useState('');
  const [isLoadingTodos, setIsLoadingTodos] = useState(true);
  const [isLoadingDraftInput, setIsLoadingDraftInput] = useState(true);
  const [isCreatingTodo, setIsCreatingTodo] = useState(false);
  const [isSavingDraftInput, setIsSavingDraftInput] = useState(false);
  const [savingTodoIds, setSavingTodoIds] = useState<Set<string>>(new Set());
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [progressNoteDrafts, setProgressNoteDrafts] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let isCurrentLoad = true;

    async function loadInitialTodos() {
      // Fetch once on mount; old localStorage data is intentionally ignored now that Supabase is the source of truth.
      try {
        const loadedTodos = await listTodos();

        if (isCurrentLoad) {
          setTodos(loadedTodos);
          setError('');
        }
      } catch (loadError) {
        if (isCurrentLoad) {
          setError(getErrorMessage(loadError, 'Unable to load todos.'));
        }
      } finally {
        if (isCurrentLoad) {
          setIsLoadingTodos(false);
        }
      }
    }

    loadInitialTodos();

    return () => {
      isCurrentLoad = false;
    };
  }, []);

  useEffect(() => {
    let isCurrentLoad = true;

    async function loadInitialDraftInput() {
      // Load the scratchpad independently so draft failures do not block normal todo list work.
      try {
        const loadedDraftInput = await getTodoDraftInput();

        if (isCurrentLoad) {
          setDraftInputContent(loadedDraftInput?.content ?? '');
          setDraftInputSavedAt(loadedDraftInput?.updatedAt);
          setDraftInputLoadError('');
        }
      } catch (loadError) {
        if (isCurrentLoad) {
          setDraftInputLoadError(
            getErrorMessage(loadError, 'Unable to load draft todos.'),
          );
        }
      } finally {
        if (isCurrentLoad) {
          setIsLoadingDraftInput(false);
        }
      }
    }

    loadInitialDraftInput();

    return () => {
      isCurrentLoad = false;
    };
  }, []);

  async function handleCreateTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // The title is the only free-text identity for a todo, so block empty items before they enter the list.
    const title = draft.title.trim();
    if (!title) {
      setError('Add a title before creating a todo.');
      return;
    }

    setIsCreatingTodo(true);

    try {
      // Create through Supabase and prepend the returned row so generated ids and timestamps are the persisted values.
      const todo = await createSupabaseTodo({
        title,
        priority: draft.priority,
        dueDate: dateInputToLocalMidnightUnixSeconds(draft.dueDate),
        reminderTime: datetimeLocalInputToUnixSeconds(draft.reminderTime),
      });

      setTodos((currentTodos) => [todo, ...currentTodos]);
      setDraft(initialDraft);
      setError('');
    } catch (createError) {
      setError(getErrorMessage(createError, 'Unable to create todo.'));
    } finally {
      setIsCreatingTodo(false);
    }
  }

  async function handleSaveDraftInput() {
    setIsSavingDraftInput(true);
    setDraftInputSaveError('');

    try {
      // Save the textarea exactly as typed; parsing into structured todos is a later workflow.
      const savedDraftInput = await saveTodoDraftInput(draftInputContent);
      setDraftInputContent(savedDraftInput.content);
      setDraftInputSavedAt(savedDraftInput.updatedAt);
    } catch (saveError) {
      setDraftInputSaveError(
        getErrorMessage(saveError, 'Unable to save draft todos.'),
      );
    } finally {
      setIsSavingDraftInput(false);
    }
  }

  function updateLocalTodo(todoId: string, updates: Partial<Todo>) {
    // Local state updates keep controls responsive for both title drafts and optimistic Supabase mutations.
    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === todoId ? { ...todo, ...updates } : todo,
      ),
    );
  }

  async function persistTodoUpdate(todoId: string, updates: UpdateTodoInput) {
    const previousTodo = todos.find((todo) => todo.id === todoId);
    if (!previousTodo) {
      return false;
    }

    setSavingTodoIds((currentIds) => new Set(currentIds).add(todoId));
    setError('');
    updateLocalTodo(todoId, updates);

    try {
      // Optimistic edits are replaced by Supabase's returned row; on failure the previous row is restored.
      const savedTodo = await updateSupabaseTodo(todoId, updates);
      setTodos((currentTodos) =>
        currentTodos.map((todo) => (todo.id === todoId ? savedTodo : todo)),
      );
      return true;
    } catch (updateError) {
      setTodos((currentTodos) =>
        currentTodos.map((todo) => (todo.id === todoId ? previousTodo : todo)),
      );
      setError(getErrorMessage(updateError, 'Unable to save todo changes.'));
      return false;
    } finally {
      setSavingTodoIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(todoId);
        return nextIds;
      });
    }
  }

  function completeTodo(todoId: string) {
    // Completion is intentionally one-way in this version so a checked item cannot drift back into active work accidentally.
    void persistTodoUpdate(todoId, { status: 'completed' });
  }

  function compareTodos(left: Todo, right: Todo) {
    const leftGroup = getTodoSortGroup(left);
    const rightGroup = getTodoSortGroup(right);

    if (leftGroup !== rightGroup) {
      return leftGroup - rightGroup;
    }

    if (leftGroup === 1) {
      return (left.dueDate ?? 0) - (right.dueDate ?? 0);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  }

  const sortedTodos = [...todos].sort(compareTodos);
  const isFormDisabled = isCreatingTodo || isLoadingTodos;
  const isDraftInputDisabled =
    isLoadingDraftInput || isSavingDraftInput || Boolean(draftInputLoadError);

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
        <div className="todo-input-column">
          <form className="todo-form" onSubmit={handleCreateTodo}>
            <label>
              <span>Title</span>
              <input
                type="text"
                value={draft.title}
                disabled={isFormDisabled}
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
                className="tone-select"
                style={getFieldToneStyle(priorityTones[draft.priority])}
                value={draft.priority}
                disabled={isFormDisabled}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    priority: event.target.value as TodoPriority,
                  }))
                }
              >
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                    style={getOptionToneStyle(
                      priorityTones[value as TodoPriority],
                    )}
                  >
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
                disabled={isFormDisabled}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    dueDate: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Reminder</span>
              <input
                type="datetime-local"
                value={draft.reminderTime}
                disabled={isFormDisabled}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    reminderTime: event.target.value,
                  }))
                }
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <button type="submit" disabled={isFormDisabled}>
              {isCreatingTodo ? 'Creating...' : 'Create todo'}
            </button>
          </form>

          <section className="todo-draft-panel" aria-labelledby="draft-heading">
            <div className="todo-draft-header">
              <h2 id="draft-heading">Draft todos</h2>
              {draftInputSavedAt ? (
                <p>Saved {formatSavedAt(draftInputSavedAt)}</p>
              ) : null}
            </div>

            <label>
              <span>Scratchpad</span>
              <textarea
                value={draftInputContent}
                disabled={isDraftInputDisabled}
                onChange={(event) => {
                  setDraftInputContent(event.target.value);
                  setDraftInputSaveError('');
                }}
                placeholder="Paste rough todo ideas here, one per line if useful."
                rows={9}
              />
            </label>

            {isLoadingDraftInput ? (
              <p className="draft-status">Loading draft todos...</p>
            ) : null}
            {draftInputLoadError ? (
              <p className="form-error">{draftInputLoadError}</p>
            ) : null}
            {draftInputSaveError ? (
              <p className="form-error">{draftInputSaveError}</p>
            ) : null}

            <button
              type="button"
              disabled={isDraftInputDisabled}
              onClick={() => void handleSaveDraftInput()}
            >
              {isSavingDraftInput ? 'Saving...' : 'Save draft'}
            </button>
          </section>
        </div>

        <div className="todo-list" aria-live="polite">
          {isLoadingTodos ? (
            <p className="empty-state">Loading todos...</p>
          ) : todos.length === 0 ? (
            <p className="empty-state">No todos yet. Create one to start.</p>
          ) : (
            sortedTodos.map((todo) => {
              const isSavingTodo = savingTodoIds.has(todo.id);
              const titleValue = titleDrafts[todo.id] ?? todo.title;
              const progressNoteValue =
                progressNoteDrafts[todo.id] ?? todo.progressNote;

              return (
                <article className="todo-item" key={todo.id}>
                  <div className="todo-title-row">
                    <label className="todo-title-field">
                      <span>Title</span>
                      <input
                        type="text"
                        value={titleValue}
                        disabled={isSavingTodo}
                        onChange={(event) =>
                          setTitleDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [todo.id]: event.target.value,
                          }))
                        }
                        onBlur={async (event) => {
                          const title = event.target.value.trim();
                          if (!title) {
                            setTitleDrafts((currentDrafts) => {
                              const nextDrafts = { ...currentDrafts };
                              delete nextDrafts[todo.id];
                              return nextDrafts;
                            });
                            setError('Todo title cannot be empty.');
                            return;
                          }

                          if (title === todo.title) {
                            setTitleDrafts((currentDrafts) => {
                              const nextDrafts = { ...currentDrafts };
                              delete nextDrafts[todo.id];
                              return nextDrafts;
                            });
                            setError('');
                            return;
                          }

                          await persistTodoUpdate(todo.id, { title });
                          setTitleDrafts((currentDrafts) => {
                            const nextDrafts = { ...currentDrafts };
                            delete nextDrafts[todo.id];
                            return nextDrafts;
                          });
                        }}
                      />
                    </label>
                  </div>

                  <label className="todo-progress-note">
                    <span>Progress note</span>
                    <textarea
                      ref={fitTextareaToContent}
                      value={progressNoteValue}
                      disabled={isSavingTodo}
                      onChange={(event) => {
                        setProgressNoteDrafts((currentDrafts) => ({
                          ...currentDrafts,
                          [todo.id]: event.target.value,
                        }));
                        fitTextareaToContent(event.currentTarget);
                      }}
                      onBlur={async (event) => {
                        const progressNote = event.target.value;

                        if (progressNote === todo.progressNote) {
                          setProgressNoteDrafts((currentDrafts) => {
                            const nextDrafts = { ...currentDrafts };
                            delete nextDrafts[todo.id];
                            return nextDrafts;
                          });
                          setError('');
                          return;
                        }

                        await persistTodoUpdate(todo.id, { progressNote });
                        setProgressNoteDrafts((currentDrafts) => {
                          const nextDrafts = { ...currentDrafts };
                          delete nextDrafts[todo.id];
                          return nextDrafts;
                        });
                      }}
                      rows={1}
                    />
                  </label>

                  <div className="todo-field-grid">
                    <label>
                      <span>Status</span>
                      <select
                        className="tone-select"
                        style={getFieldToneStyle(statusTones[todo.status])}
                        value={todo.status}
                        disabled={todo.status === 'completed' || isSavingTodo}
                        onChange={(event) =>
                          void persistTodoUpdate(todo.id, {
                            status: event.target.value as TodoStatus,
                          })
                        }
                      >
                        <option
                          value="planned"
                          style={getOptionToneStyle(statusTones.planned)}
                        >
                          Planned
                        </option>
                        <option
                          value="in-progress"
                          style={getOptionToneStyle(statusTones['in-progress'])}
                        >
                          In progress
                        </option>
                        {todo.status === 'completed' ? (
                          <option
                            value="completed"
                            style={getOptionToneStyle(statusTones.completed)}
                          >
                            Completed
                          </option>
                        ) : null}
                      </select>
                    </label>

                    <label>
                      <span>Priority</span>
                      <select
                        className="tone-select"
                        style={getFieldToneStyle(priorityTones[todo.priority])}
                        value={todo.priority}
                        disabled={isSavingTodo}
                        onChange={(event) =>
                          void persistTodoUpdate(todo.id, {
                            priority: event.target.value as TodoPriority,
                          })
                        }
                      >
                        {Object.entries(priorityLabels).map(
                          ([value, label]) => (
                            <option
                              key={value}
                              value={value}
                              style={getOptionToneStyle(
                                priorityTones[value as TodoPriority],
                              )}
                            >
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label>
                      <span>Due date</span>
                      <input
                        type="date"
                        value={unixSecondsToDateInput(todo.dueDate)}
                        disabled={isSavingTodo}
                        onChange={(event) =>
                          void persistTodoUpdate(todo.id, {
                            dueDate: dateInputToLocalMidnightUnixSeconds(
                              event.target.value,
                            ),
                          })
                        }
                      />
                    </label>

                    <label>
                      <span>Reminder</span>
                      <input
                        type="datetime-local"
                        value={unixSecondsToDatetimeLocalInput(
                          todo.reminderTime,
                        )}
                        disabled={isSavingTodo}
                        onChange={(event) =>
                          void persistTodoUpdate(todo.id, {
                            reminderTime: datetimeLocalInputToUnixSeconds(
                              event.target.value,
                            ),
                          })
                        }
                      />
                    </label>

                    <label className="complete-control">
                      <span>Complete</span>
                      <input
                        type="checkbox"
                        checked={todo.status === 'completed'}
                        disabled={todo.status === 'completed' || isSavingTodo}
                        onChange={() => completeTodo(todo.id)}
                      />
                    </label>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

function getTodoSortGroup(todo: Todo) {
  // The list prioritizes active dated work, then active undated work, then completed history.
  if (todo.status === 'completed') {
    return 3;
  }

  if (todo.dueDate !== undefined) {
    return 1;
  }

  return 2;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
