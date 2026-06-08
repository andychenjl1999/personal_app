'use client';

import {
  CSSProperties,
  DragEvent,
  FormEvent,
  useEffect,
  useState,
} from 'react';

import {
  createDailyPlannerItem,
  createDailyPlannerItems,
  DailyPlannerItem,
  deleteDailyPlannerItem,
  listDailyPlannerItems,
  UpdateDailyPlannerItemInput,
  updateDailyPlannerItem,
  updateDailyPlannerItemPositions,
} from './daily-planner-data';
import { getTodoDraftInput, saveTodoDraftInput } from './todo-draft-data';
import {
  createTodo as createSupabaseTodo,
  createTodosFromTitles,
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

type DueDateFilter = 'all' | 'today' | 'unspecified';
type StatusFilter = 'all' | Extract<TodoStatus, 'planned' | 'in-progress'>;
type PriorityFilter = 'all' | TodoPriority;

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

const dueDateFilterLabels: Record<DueDateFilter, string> = {
  all: 'All',
  today: 'Today',
  unspecified: 'Unspecified',
};

const statusFilterLabels: Record<StatusFilter, string> = {
  all: 'All',
  planned: 'Planned',
  'in-progress': 'In progress',
};

const priorityFilterLabels: Record<PriorityFilter, string> = {
  all: 'All',
  ...priorityLabels,
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

function isTodoDueToday(todo: Todo) {
  if (todo.dueDate === undefined) {
    return false;
  }

  const dueDate = unixSecondsToDate(todo.dueDate);
  const today = new Date();

  return (
    dueDate.getFullYear() === today.getFullYear() &&
    dueDate.getMonth() === today.getMonth() &&
    dueDate.getDate() === today.getDate()
  );
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
  const [plannerItems, setPlannerItems] = useState<DailyPlannerItem[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState<TodoDraft>(initialDraft);
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [draftInputContent, setDraftInputContent] = useState('');
  const [draftInputSavedAt, setDraftInputSavedAt] = useState<string>();
  const [plannerError, setPlannerError] = useState('');
  const [error, setError] = useState('');
  const [draftInputLoadError, setDraftInputLoadError] = useState('');
  const [draftInputSaveError, setDraftInputSaveError] = useState('');
  const [isLoadingPlannerItems, setIsLoadingPlannerItems] = useState(true);
  const [isCreatingPlannerItem, setIsCreatingPlannerItem] = useState(false);
  const [isImportingPlannerTodos, setIsImportingPlannerTodos] = useState(false);
  const [isLoadingTodos, setIsLoadingTodos] = useState(true);
  const [isLoadingDraftInput, setIsLoadingDraftInput] = useState(true);
  const [isCreatingTodo, setIsCreatingTodo] = useState(false);
  const [isSavingDraftInput, setIsSavingDraftInput] = useState(false);
  const [isConvertingDraftTodos, setIsConvertingDraftTodos] = useState(false);
  const [savingPlannerItemIds, setSavingPlannerItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [draggingPlannerItemId, setDraggingPlannerItemId] = useState<string>();
  const [plannerStartTimeDrafts, setPlannerStartTimeDrafts] = useState<
    Record<string, string>
  >({});
  const [plannerEndTimeDrafts, setPlannerEndTimeDrafts] = useState<
    Record<string, string>
  >({});
  const [plannerTitleDrafts, setPlannerTitleDrafts] = useState<
    Record<string, string>
  >({});
  const [savingTodoIds, setSavingTodoIds] = useState<Set<string>>(new Set());
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [progressNoteDrafts, setProgressNoteDrafts] = useState<
    Record<string, string>
  >({});
  const [dueDateDrafts, setDueDateDrafts] = useState<Record<string, string>>(
    {},
  );
  const [reminderTimeDrafts, setReminderTimeDrafts] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let isCurrentLoad = true;

    async function loadInitialPlannerItems() {
      try {
        const loadedPlannerItems = await listDailyPlannerItems();

        if (isCurrentLoad) {
          setPlannerItems(normalizePlannerPositions(loadedPlannerItems));
          setPlannerError('');
        }
      } catch (loadError) {
        if (isCurrentLoad) {
          setPlannerError(
            getErrorMessage(loadError, 'Unable to load daily planner.'),
          );
        }
      } finally {
        if (isCurrentLoad) {
          setIsLoadingPlannerItems(false);
        }
      }
    }

    loadInitialPlannerItems();

    return () => {
      isCurrentLoad = false;
    };
  }, []);

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

  async function handleConvertDraftTodos() {
    const draftTodoTitles = getDraftTodoTitles(draftInputContent);
    if (draftTodoTitles.length === 0) {
      setDraftInputSaveError(
        'Add at least one draft todo line before converting.',
      );
      return;
    }

    setIsConvertingDraftTodos(true);
    setDraftInputSaveError('');

    try {
      // Convert all parsed lines before clearing the scratchpad so failed inserts leave the draft intact.
      const convertedTodos = await createTodosFromTitles(draftTodoTitles);
      const savedDraftInput = await saveTodoDraftInput('');

      setTodos((currentTodos) => [...convertedTodos, ...currentTodos]);
      setDraftInputContent(savedDraftInput.content);
      setDraftInputSavedAt(savedDraftInput.updatedAt);
      setError('');
    } catch (convertError) {
      setDraftInputSaveError(
        getErrorMessage(convertError, 'Unable to convert draft todos.'),
      );
    } finally {
      setIsConvertingDraftTodos(false);
    }
  }

  async function handleCreatePlannerItem() {
    setIsCreatingPlannerItem(true);
    setPlannerError('');

    try {
      const plannerItem = await createDailyPlannerItem(plannerItems.length);
      setPlannerItems((currentItems) =>
        normalizePlannerPositions([...currentItems, plannerItem]),
      );
    } catch (createError) {
      setPlannerError(
        getErrorMessage(createError, 'Unable to create planner row.'),
      );
    } finally {
      setIsCreatingPlannerItem(false);
    }
  }

  async function handleImportTodosIntoPlanner() {
    const importableTodos = getPlannerImportTodos(sortedTodos);

    if (importableTodos.length === 0) {
      setPlannerError('');
      return;
    }

    setIsImportingPlannerTodos(true);
    setPlannerError('');

    try {
      // Imported todos are appended exactly as new planner rows; repeated imports intentionally create duplicates.
      const importedPlannerItems = await createDailyPlannerItems(
        importableTodos.map((todo, index) => ({
          position: plannerItems.length + index,
          startTime: '',
          title: todo.title,
        })),
      );

      setPlannerItems((currentItems) =>
        normalizePlannerPositions([...currentItems, ...importedPlannerItems]),
      );
    } catch (importError) {
      setPlannerError(
        getErrorMessage(importError, 'Unable to import todos into planner.'),
      );
    } finally {
      setIsImportingPlannerTodos(false);
    }
  }

  function updateLocalPlannerItem(
    plannerItemId: string,
    updates: Partial<DailyPlannerItem>,
  ) {
    // Planner rows save independently from todos, so local optimistic edits are scoped to this table only.
    setPlannerItems((currentItems) =>
      currentItems.map((item) =>
        item.id === plannerItemId ? { ...item, ...updates } : item,
      ),
    );
  }

  async function persistPlannerItemUpdate(
    plannerItemId: string,
    updates: UpdateDailyPlannerItemInput,
  ) {
    const previousPlannerItem = plannerItems.find(
      (item) => item.id === plannerItemId,
    );
    if (!previousPlannerItem) {
      return false;
    }

    setSavingPlannerItemIds((currentIds) =>
      new Set(currentIds).add(plannerItemId),
    );
    setPlannerError('');
    updateLocalPlannerItem(plannerItemId, updates);

    try {
      const savedPlannerItem = await updateDailyPlannerItem(
        plannerItemId,
        updates,
      );
      setPlannerItems((currentItems) =>
        currentItems.map((item) =>
          item.id === plannerItemId ? savedPlannerItem : item,
        ),
      );
      return true;
    } catch (updateError) {
      setPlannerItems((currentItems) =>
        currentItems.map((item) =>
          item.id === plannerItemId ? previousPlannerItem : item,
        ),
      );
      setPlannerError(
        getErrorMessage(updateError, 'Unable to save planner changes.'),
      );
      return false;
    } finally {
      setSavingPlannerItemIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(plannerItemId);
        return nextIds;
      });
    }
  }

  async function persistPlannerPositions(nextItems: DailyPlannerItem[]) {
    const normalizedItems = normalizePlannerPositions(nextItems);
    const previousItems = plannerItems;

    setPlannerItems(normalizedItems);
    setPlannerError('');

    try {
      await updateDailyPlannerItemPositions(
        normalizedItems.map((item) => ({
          id: item.id,
          position: item.position,
        })),
      );
      return true;
    } catch (updateError) {
      setPlannerItems(previousItems);
      setPlannerError(
        getErrorMessage(updateError, 'Unable to save planner order.'),
      );
      return false;
    }
  }

  async function handleDeletePlannerItem(plannerItemId: string) {
    const previousItems = plannerItems;
    const remainingItems = normalizePlannerPositions(
      plannerItems.filter((item) => item.id !== plannerItemId),
    );

    setSavingPlannerItemIds((currentIds) =>
      new Set(currentIds).add(plannerItemId),
    );
    setPlannerItems(remainingItems);
    setPlannerError('');

    try {
      await deleteDailyPlannerItem(plannerItemId);
    } catch (deleteError) {
      setPlannerItems(previousItems);
      setPlannerError(
        getErrorMessage(deleteError, 'Unable to delete planner row.'),
      );
      return;
    } finally {
      setSavingPlannerItemIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(plannerItemId);
        return nextIds;
      });
    }

    clearPlannerDrafts(plannerItemId);

    try {
      await updateDailyPlannerItemPositions(
        remainingItems.map((item) => ({
          id: item.id,
          position: item.position,
        })),
      );
    } catch (positionError) {
      // The row is already deleted in Supabase, so keep it removed locally and surface only the compaction failure.
      setPlannerError(
        getErrorMessage(positionError, 'Unable to save planner order.'),
      );
    }
  }

  function handlePlannerDragStart(
    event: DragEvent<HTMLButtonElement>,
    plannerItemId: string,
  ) {
    setDraggingPlannerItemId(plannerItemId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', plannerItemId);
  }

  function handlePlannerDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handlePlannerDragEnd() {
    setDraggingPlannerItemId(undefined);
  }

  async function handlePlannerDrop(
    event: DragEvent<HTMLDivElement>,
    targetPlannerItemId: string,
  ) {
    event.preventDefault();

    const sourcePlannerItemId =
      draggingPlannerItemId || event.dataTransfer.getData('text/plain');
    setDraggingPlannerItemId(undefined);

    if (!sourcePlannerItemId || sourcePlannerItemId === targetPlannerItemId) {
      return;
    }

    const sourceIndex = plannerItems.findIndex(
      (item) => item.id === sourcePlannerItemId,
    );
    const targetIndex = plannerItems.findIndex(
      (item) => item.id === targetPlannerItemId,
    );

    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    const reorderedItems = [...plannerItems];
    const [movedItem] = reorderedItems.splice(sourceIndex, 1);
    reorderedItems.splice(targetIndex, 0, movedItem);

    await persistPlannerPositions(reorderedItems);
  }

  function clearPlannerDrafts(plannerItemId: string) {
    setPlannerStartTimeDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[plannerItemId];
      return nextDrafts;
    });
    setPlannerEndTimeDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[plannerItemId];
      return nextDrafts;
    });
    setPlannerTitleDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[plannerItemId];
      return nextDrafts;
    });
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
  const visibleTodos = sortedTodos.filter((todo) => {
    if (dueDateFilter === 'today' && !isTodoDueToday(todo)) {
      return false;
    }

    if (dueDateFilter === 'unspecified' && todo.dueDate !== undefined) {
      return false;
    }

    if (statusFilter !== 'all' && todo.status !== statusFilter) {
      return false;
    }

    if (priorityFilter !== 'all' && todo.priority !== priorityFilter) {
      return false;
    }

    return true;
  });
  const isFormDisabled = isCreatingTodo || isLoadingTodos;
  const isPlannerAddDisabled =
    isLoadingPlannerItems || isCreatingPlannerItem || isImportingPlannerTodos;
  const isPlannerImportDisabled =
    isLoadingPlannerItems ||
    isLoadingTodos ||
    isCreatingPlannerItem ||
    isImportingPlannerTodos;
  const isDraftInputDisabled =
    isLoadingDraftInput ||
    isSavingDraftInput ||
    isConvertingDraftTodos ||
    Boolean(draftInputLoadError);
  const draftTodoTitles = getDraftTodoTitles(draftInputContent);
  const isConvertDraftTodosDisabled =
    isDraftInputDisabled || draftTodoTitles.length === 0;

  return (
    <main className="todo-shell">
      <section className="todo-header">
        <div>
          <p className="eyebrow">Personal App v2</p>
          <h1>TODO list</h1>
        </div>
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

            <div className="todo-draft-actions">
              <button
                type="button"
                disabled={isDraftInputDisabled}
                onClick={() => void handleSaveDraftInput()}
              >
                {isSavingDraftInput ? 'Saving...' : 'Save draft'}
              </button>
              <button
                type="button"
                disabled={isConvertDraftTodosDisabled}
                onClick={() => void handleConvertDraftTodos()}
              >
                {isConvertingDraftTodos ? 'Converting...' : 'Convert todos'}
              </button>
            </div>
          </section>
        </div>

        <div className="todo-list" aria-live="polite">

          <section className="daily-planner" aria-labelledby="planner-heading">
            <div className="daily-planner-header">
              <div>
                <h2 id="planner-heading">Today&apos;s planner</h2>
              </div>
              <div className="daily-planner-actions">
                <button
                  type="button"
                  disabled={isPlannerImportDisabled}
                  onClick={() => void handleImportTodosIntoPlanner()}
                >
                  {isImportingPlannerTodos ? 'Importing...' : 'Import todos'}
                </button>
                <button
                  type="button"
                  disabled={isPlannerAddDisabled}
                  onClick={() => void handleCreatePlannerItem()}
                >
                  {isCreatingPlannerItem ? 'Adding...' : 'Add row'}
                </button>
              </div>
            </div>

            {plannerError ? <p className="form-error">{plannerError}</p> : null}

            <div className="daily-planner-table-wrap">
              <div className="daily-planner-table" role="table">
                <div
                  className="daily-planner-row daily-planner-row-header"
                  role="row"
                >
                  <span role="columnheader">Start</span>
                  <span role="columnheader">Title</span>
                  <span role="columnheader">Delete</span>
                  <span role="columnheader"> </span>
                </div>

                {isLoadingPlannerItems ? (
                  <p className="daily-planner-status">Loading planner...</p>
                ) : plannerItems.length === 0 ? (
                  <p className="daily-planner-status">No planner rows yet.</p>
                ) : (
                  plannerItems.map((plannerItem) => {
                    const isSavingPlannerItem = savingPlannerItemIds.has(
                      plannerItem.id,
                    );
                    const startTimeValue =
                      plannerStartTimeDrafts[plannerItem.id] ??
                      plannerItem.startTime;
                    const titleValue =
                      plannerTitleDrafts[plannerItem.id] ?? plannerItem.title;
                    const isDragging = draggingPlannerItemId === plannerItem.id;

                    return (
                      <div
                        className={`daily-planner-row${isDragging ? ' is-dragging' : ''
                          }`}
                        key={plannerItem.id}
                        role="row"
                        onDragOver={handlePlannerDragOver}
                        onDrop={(event) =>
                          void handlePlannerDrop(event, plannerItem.id)
                        }
                      >
                        <input
                          aria-label="Start time"
                          type="text"
                          value={startTimeValue}
                          disabled={isSavingPlannerItem}
                          onChange={(event) =>
                            setPlannerStartTimeDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [plannerItem.id]: event.target.value,
                            }))
                          }
                          onBlur={async (event) => {
                            const startTime = event.target.value;

                            if (startTime !== plannerItem.startTime) {
                              await persistPlannerItemUpdate(plannerItem.id, {
                                startTime,
                              });
                            }

                            setPlannerStartTimeDrafts((currentDrafts) => {
                              const nextDrafts = { ...currentDrafts };
                              delete nextDrafts[plannerItem.id];
                              return nextDrafts;
                            });
                          }}
                        />
                        <textarea
                          aria-label="Title"
                          ref={fitTextareaToContent}
                          value={titleValue}
                          disabled={isSavingPlannerItem}
                          rows={1}
                          onChange={(event) => {
                            setPlannerTitleDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [plannerItem.id]: event.target.value,
                            }));
                            fitTextareaToContent(event.currentTarget);
                          }}
                          onBlur={async (event) => {
                            const title = event.target.value;

                            if (title !== plannerItem.title) {
                              await persistPlannerItemUpdate(plannerItem.id, {
                                title,
                              });
                            }

                            setPlannerTitleDrafts((currentDrafts) => {
                              const nextDrafts = { ...currentDrafts };
                              delete nextDrafts[plannerItem.id];
                              return nextDrafts;
                            });
                          }}
                        />
                        <button
                          className="daily-planner-icon-button daily-planner-delete"
                          type="button"
                          disabled={isSavingPlannerItem}
                          title="Delete row"
                          aria-label="Delete planner row"
                          onClick={() =>
                            void handleDeletePlannerItem(plannerItem.id)
                          }
                        >
                          x
                        </button>
                        <button
                          className="daily-planner-icon-button daily-planner-drag-handle"
                          type="button"
                          draggable={!isSavingPlannerItem}
                          disabled={isSavingPlannerItem}
                          title="Move row"
                          aria-label="Move planner row"
                          onDragStart={(event) =>
                            handlePlannerDragStart(event, plannerItem.id)
                          }
                          onDragEnd={handlePlannerDragEnd}
                        >
                          =
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <div className="todo-filter-bar" aria-label="Todo filters">
            <label>
              <span>Due date</span>
              <select
                value={dueDateFilter}
                onChange={(event) =>
                  setDueDateFilter(event.target.value as DueDateFilter)
                }
              >
                {Object.entries(dueDateFilterLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
              >
                {Object.entries(statusFilterLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Priority</span>
              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value as PriorityFilter)
                }
              >
                {Object.entries(priorityFilterLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isLoadingTodos ? (
            <p className="empty-state">Loading todos...</p>
          ) : todos.length === 0 ? (
            <p className="empty-state">No todos yet. Create one to start.</p>
          ) : visibleTodos.length === 0 ? (
            <p className="empty-state">No todos match the selected filters.</p>
          ) : (
            visibleTodos.map((todo) => {
              const isSavingTodo = savingTodoIds.has(todo.id);
              const titleValue = titleDrafts[todo.id] ?? todo.title;
              const progressNoteValue =
                progressNoteDrafts[todo.id] ?? todo.progressNote;
              const dueDateValue =
                dueDateDrafts[todo.id] ?? unixSecondsToDateInput(todo.dueDate);
              const reminderTimeValue =
                reminderTimeDrafts[todo.id] ??
                unixSecondsToDatetimeLocalInput(todo.reminderTime);

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
                        value={dueDateValue}
                        disabled={isSavingTodo}
                        onChange={(event) => {
                          // Native date pickers can emit changes while navigating months; persist only after the user leaves the field.
                          setDueDateDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [todo.id]: event.target.value,
                          }));
                        }}
                        onBlur={async (event) => {
                          const dueDate = event.target.value;
                          const currentDueDate = unixSecondsToDateInput(
                            todo.dueDate,
                          );

                          if (dueDate === currentDueDate) {
                            setDueDateDrafts((currentDrafts) => {
                              const nextDrafts = { ...currentDrafts };
                              delete nextDrafts[todo.id];
                              return nextDrafts;
                            });
                            setError('');
                            return;
                          }

                          await persistTodoUpdate(todo.id, {
                            dueDate:
                              dateInputToLocalMidnightUnixSeconds(dueDate),
                          });
                          setDueDateDrafts((currentDrafts) => {
                            const nextDrafts = { ...currentDrafts };
                            delete nextDrafts[todo.id];
                            return nextDrafts;
                          });
                        }}
                      />
                    </label>

                    <label>
                      <span>Reminder</span>
                      <input
                        type="datetime-local"
                        value={reminderTimeValue}
                        disabled={isSavingTodo}
                        onChange={(event) =>
                          setReminderTimeDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [todo.id]: event.target.value,
                          }))
                        }
                        onBlur={async (event) => {
                          const reminderTime = event.target.value;
                          const currentReminderTime =
                            unixSecondsToDatetimeLocalInput(todo.reminderTime);

                          if (reminderTime === currentReminderTime) {
                            setReminderTimeDrafts((currentDrafts) => {
                              const nextDrafts = { ...currentDrafts };
                              delete nextDrafts[todo.id];
                              return nextDrafts;
                            });
                            setError('');
                            return;
                          }

                          await persistTodoUpdate(todo.id, {
                            reminderTime:
                              datetimeLocalInputToUnixSeconds(reminderTime),
                          });
                          setReminderTimeDrafts((currentDrafts) => {
                            const nextDrafts = { ...currentDrafts };
                            delete nextDrafts[todo.id];
                            return nextDrafts;
                          });
                        }}
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

function getDraftTodoTitles(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function getPlannerImportTodos(todos: Todo[]) {
  const todayDateInput = getLocalDateInput(new Date());
  const dueTodayTodos = todos.filter(
    (todo) =>
      todo.dueDate !== undefined &&
      unixSecondsToDateInput(todo.dueDate) === todayDateInput,
  );
  const undatedTodos = todos.filter((todo) => todo.dueDate === undefined);

  return [...dueTodayTodos, ...undatedTodos];
}

function getLocalDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function normalizePlannerPositions(items: DailyPlannerItem[]) {
  return items.map((item, index) => ({
    ...item,
    position: index,
  }));
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
