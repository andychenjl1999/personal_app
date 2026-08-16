'use client';

import Link from 'next/link';
import { DragEvent, Fragment, useEffect, useRef, useState } from 'react';

import {
  dateKeyToUnixSeconds,
  executionTimeToTimeInput,
  formatLongDate,
  formatShortDate,
  shiftDateKey,
  timeInputToExecutionTime,
  unixSecondsToDateKey,
} from './todo-date';
import { Todo } from './todo-data';
import {
  TodoModalCoordinator,
  TodoModalRequest,
} from './todo-modal-coordinator';
import {
  getDraggedTodoId,
  sortTodosForDisplay,
  TodoDropEdge,
  TodoErrorBanner,
  TodoLoadingState,
  TodoTitleItem,
  UnscheduledTodoPanel,
} from './todo-view-parts';
import { useTodoCollection } from './use-todo-collection';
import { VoiceTodoButton } from './voice-todo-button';

type DateDropTargetProps = {
  dateKey: string;
  direction: 'Previous day' | 'Next day';
  onMove: (todoId: string, dateKey: string) => void;
};

function DateDropTarget({ dateKey, direction, onMove }: DateDropTargetProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className={`adjacent-day-drop${isDragOver ? ' is-drag-over' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragOver(false);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
        const todoId = getDraggedTodoId(event);
        if (todoId) {
          onMove(todoId, dateKey);
        }
      }}
    >
      <span>{direction}</span>
      <strong>{formatShortDate(dateKey)}</strong>
      <small>Drop a task to move it here</small>
    </div>
  );
}

type TodoInsertionControlProps = {
  position: number;
  onInsert: (position: number) => void;
  onMove: (todoId: string, position: number) => void;
};

function TodoInsertionControl({
  position,
  onInsert,
  onMove,
}: TodoInsertionControlProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <button
      aria-label={`Add todo at position ${position}`}
      className={`day-todo-insertion${isDragOver ? ' is-drag-over' : ''}`}
      onClick={() => onInsert(position)}
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragOver(false);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
        const todoId = getDraggedTodoId(event);
        if (todoId) {
          onMove(todoId, position);
        }
      }}
      type="button"
    >
      <span aria-hidden="true">＋</span>
      Add todo
    </button>
  );
}

type DailyTodoRowProps = {
  todo: Todo;
  onComplete: (todoId: string) => Promise<Todo>;
  onDropAt: (draggedTodoId: string, edge: TodoDropEdge) => void;
  onOpen: (todo: Todo) => void;
  onSaveExecutionTime: (
    todoId: string,
    executionTime?: string,
  ) => Promise<Todo>;
};

function DailyTodoRow({
  todo,
  onComplete,
  onDropAt,
  onOpen,
  onSaveExecutionTime,
}: DailyTodoRowProps) {
  const persistedTimeInput = executionTimeToTimeInput(todo.executionTime);
  const [draftExecutionTime, setDraftExecutionTime] =
    useState(persistedTimeInput);
  const [isCompleting, setIsCompleting] = useState(false);
  const [rowDropEdge, setRowDropEdge] = useState<TodoDropEdge>();
  const draftExecutionTimeRef = useRef(draftExecutionTime);
  const persistedTimeInputRef = useRef(persistedTimeInput);
  const hasUnsavedChangeRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    persistedTimeInputRef.current = persistedTimeInput;

    // A slower response must not overwrite a newer time that is still waiting to save.
    // Invalid legacy strings map to an empty control but remain untouched until the user
    // deliberately selects a valid time.
    if (!hasUnsavedChangeRef.current) {
      draftExecutionTimeRef.current = persistedTimeInput;
      setDraftExecutionTime(persistedTimeInput);
    }
  }, [persistedTimeInput]);

  useEffect(
    () => () => {
      if (saveTimeoutRef.current !== undefined) {
        clearTimeout(saveTimeoutRef.current);
      }
    },
    [],
  );

  function getDropEdge(event: DragEvent<HTMLDivElement>): TodoDropEdge {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
  }

  async function saveExecutionTime(value: string) {
    if (saveTimeoutRef.current !== undefined) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = undefined;
    }

    const normalizedValue = value.trim();
    if (normalizedValue === persistedTimeInputRef.current) {
      hasUnsavedChangeRef.current = false;
      draftExecutionTimeRef.current = normalizedValue;
      setDraftExecutionTime(normalizedValue);
      return;
    }

    try {
      const savedTodo = await onSaveExecutionTime(
        todo.id,
        timeInputToExecutionTime(normalizedValue),
      );
      const savedTimeInput = executionTimeToTimeInput(savedTodo.executionTime);
      persistedTimeInputRef.current = savedTimeInput;

      if (draftExecutionTimeRef.current === value) {
        hasUnsavedChangeRef.current = false;
        draftExecutionTimeRef.current = savedTimeInput;
        setDraftExecutionTime(savedTimeInput);
      }
    } catch {
      // The collection hook exposes the backend error. Keep the draft so blur or another
      // edit can retry without discarding what the user typed.
    }
  }

  function handleExecutionTimeChange(value: string) {
    draftExecutionTimeRef.current = value;
    hasUnsavedChangeRef.current =
      value.trim() !== persistedTimeInputRef.current;
    setDraftExecutionTime(value);

    if (saveTimeoutRef.current !== undefined) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      void saveExecutionTime(value);
    }, 500);
  }

  async function completeTodo() {
    setIsCompleting(true);

    try {
      await onComplete(todo.id);
    } catch {
      // The collection hook exposes the backend error. Restore the checkbox so the
      // user can retry completing the item without reopening its edit modal.
      setIsCompleting(false);
    }
  }

  return (
    <div
      className={`day-todo-row${rowDropEdge ? ` is-drop-${rowDropEdge}` : ''}`}
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setRowDropEdge(getDropEdge(event));
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setRowDropEdge(undefined);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setRowDropEdge(getDropEdge(event));
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const draggedTodoId = getDraggedTodoId(event);
        const resolvedDropEdge = rowDropEdge ?? getDropEdge(event);
        setRowDropEdge(undefined);

        if (draggedTodoId && draggedTodoId !== todo.id) {
          onDropAt(draggedTodoId, resolvedDropEdge);
        }
      }}
    >
      <label className="day-todo-complete">
        <input
          aria-label={`Complete ${todo.title}`}
          checked={isCompleting}
          disabled={isCompleting}
          onChange={(event) => {
            if (event.target.checked) {
              void completeTodo();
            }
          }}
          type="checkbox"
        />
      </label>
      <input
        aria-label={`Execution time for ${todo.title}`}
        className="day-todo-execution-time"
        onBlur={() => void saveExecutionTime(draftExecutionTimeRef.current)}
        onChange={(event) => handleExecutionTimeChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        step={60}
        type="time"
        value={draftExecutionTime}
      />
      <TodoTitleItem onDropAt={onDropAt} onOpen={onOpen} todo={todo} />
    </div>
  );
}

export function DayView({ dateKey }: { dateKey: string }) {
  const [modalRequest, setModalRequest] = useState<TodoModalRequest>(null);
  const [workflowError, setWorkflowError] = useState('');
  const [isDayDragOver, setIsDayDragOver] = useState(false);
  const {
    todos,
    isLoading,
    error,
    clearError,
    createItem,
    createItems,
    updateItem,
    moveItem,
  } = useTodoCollection();
  const previousDateKey = shiftDateKey(dateKey, -1);
  const nextDateKey = shiftDateKey(dateKey, 1);
  const scheduledTodos = sortTodosForDisplay(
    todos.filter(
      (todo) =>
        todo.dueDate !== undefined &&
        unixSecondsToDateKey(todo.dueDate) === dateKey,
    ),
  );
  const unscheduledTodos = todos.filter((todo) => todo.dueDate === undefined);

  function moveTodoToDate(
    todoId: string,
    destination?: string,
    destinationOrder?: number,
  ) {
    void moveItem(
      todoId,
      dateKeyToUnixSeconds(destination),
      destinationOrder,
    ).catch(() => {
      // The collection hook restores the previous row and exposes the backend error.
    });
  }

  function moveTodoToDisplayedDayEnd(todoId: string) {
    const isAlreadyOnDisplayedDay = scheduledTodos.some(
      (todo) => todo.id === todoId,
    );
    const destinationOrder =
      scheduledTodos.length + (isAlreadyOnDisplayedDay ? 0 : 1);

    moveTodoToDate(todoId, dateKey, destinationOrder);
  }

  function moveTodoRelativeTo(
    draggedTodoId: string,
    targetTodoId: string,
    edge: TodoDropEdge,
  ) {
    const destinationWithoutDraggedTodo = scheduledTodos.filter(
      (todo) => todo.id !== draggedTodoId,
    );
    const targetIndex = destinationWithoutDraggedTodo.findIndex(
      (todo) => todo.id === targetTodoId,
    );

    if (targetIndex < 0) {
      moveTodoToDisplayedDayEnd(draggedTodoId);
      return;
    }

    const destinationOrder = targetIndex + (edge === 'before' ? 1 : 2);
    moveTodoToDate(draggedTodoId, dateKey, destinationOrder);
  }

  function openTodoInsertion(position: number) {
    setWorkflowError('');
    setModalRequest({
      kind: 'create',
      defaultDate: dateKey,
      defaultDailyExecutionOrder: position,
      lockExecutionDate: true,
    });
  }

  function moveTodoToInsertionPosition(todoId: string, position: number) {
    const draggedTodo = scheduledTodos.find((todo) => todo.id === todoId);
    const destinationOrder =
      draggedTodo?.dailyExecutionOrder !== undefined &&
      draggedTodo.dailyExecutionOrder < position
        ? position - 1
        : position;

    moveTodoToDate(todoId, dateKey, destinationOrder);
  }

  function handleDayDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDayDragOver(false);
    const todoId = getDraggedTodoId(event);
    if (todoId) {
      moveTodoToDisplayedDayEnd(todoId);
    }
  }

  return (
    <main className="app-shell day-app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span aria-hidden="true" className="brand-mark">
            ✓
          </span>
          <div>
            <p className="eyebrow">Personal planner</p>
            <p className="brand-name">Todo Calendar</p>
          </div>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary" href="/todos">
            All todos
          </Link>
          <button
            className="button button-secondary"
            onClick={() => {
              setWorkflowError('');
              setModalRequest({ kind: 'draft' });
            }}
            type="button"
          >
            Draft todos
          </button>
          <button
            className="button button-secondary"
            onClick={() => {
              setWorkflowError('');
              setModalRequest({
                kind: 'recurring',
                defaultStartDate: dateKey,
              });
            }}
            type="button"
          >
            Recurring todo
          </button>
          <VoiceTodoButton
            onCreate={createItem}
            onRecognitionError={setWorkflowError}
          />
          <button
            className="button button-primary"
            onClick={() => {
              setWorkflowError('');
              setModalRequest({ kind: 'create', defaultDate: dateKey });
            }}
            type="button"
          >
            <span aria-hidden="true">＋</span> New todo
          </button>
        </div>
      </header>

      <TodoErrorBanner
        error={workflowError || error}
        onDismiss={() => {
          if (workflowError) {
            setWorkflowError('');
          } else {
            clearError();
          }
        }}
      />

      <section className="day-toolbar">
        <div>
          <Link className="back-link" href={`/?month=${dateKey.slice(0, 7)}`}>
            ← Back to month
          </Link>
          <p className="eyebrow">Day view</p>
          <h1>{formatLongDate(dateKey)}</h1>
        </div>
        <nav aria-label="Day navigation" className="toolbar-actions">
          <Link
            aria-label={`Open ${formatShortDate(previousDateKey)}`}
            className="icon-button"
            href={`/day/${previousDateKey}`}
          >
            ←
          </Link>
          <Link
            aria-label={`Open ${formatShortDate(nextDateKey)}`}
            className="icon-button"
            href={`/day/${nextDateKey}`}
          >
            →
          </Link>
        </nav>
      </section>

      {isLoading ? (
        <TodoLoadingState />
      ) : (
        <div className="day-layout">
          <section
            className={`day-surface${isDayDragOver ? ' is-drag-over' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDayDragOver(true);
            }}
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              ) {
                setIsDayDragOver(false);
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={handleDayDrop}
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">On the plan</p>
                <h2>Tasks for this day</h2>
              </div>
              <span className="count-badge">{scheduledTodos.length}</span>
            </div>
            <p className="panel-description">
              Drag tasks to set their order, or bring unscheduled tasks onto
              this day.
            </p>

            <div className="day-todo-list">
              {scheduledTodos.length ? (
                <>
                  <TodoInsertionControl
                    onInsert={openTodoInsertion}
                    onMove={moveTodoToInsertionPosition}
                    position={1}
                  />
                  {scheduledTodos.map((todo, index) => (
                    <Fragment key={todo.id}>
                      <DailyTodoRow
                        onComplete={(todoId) =>
                          updateItem(todoId, { status: 'completed' })
                        }
                        onDropAt={(draggedTodoId, edge) =>
                          moveTodoRelativeTo(draggedTodoId, todo.id, edge)
                        }
                        onOpen={(selectedTodo) => {
                          setWorkflowError('');
                          setModalRequest({
                            kind: 'update',
                            todo: selectedTodo,
                          });
                        }}
                        onSaveExecutionTime={(todoId, executionTime) =>
                          updateItem(todoId, { executionTime })
                        }
                        todo={todo}
                      />
                      <TodoInsertionControl
                        onInsert={openTodoInsertion}
                        onMove={moveTodoToInsertionPosition}
                        position={index + 2}
                      />
                    </Fragment>
                  ))}
                </>
              ) : (
                <>
                  <div className="day-empty-state">
                    <span aria-hidden="true">○</span>
                    <strong>No tasks scheduled</strong>
                    <p>Drop a task here or create one for this date.</p>
                  </div>
                  <TodoInsertionControl
                    onInsert={openTodoInsertion}
                    onMove={moveTodoToInsertionPosition}
                    position={1}
                  />
                </>
              )}
            </div>

            <div className="adjacent-drop-grid">
              <DateDropTarget
                dateKey={previousDateKey}
                direction="Previous day"
                onMove={moveTodoToDate}
              />
              <DateDropTarget
                dateKey={nextDateKey}
                direction="Next day"
                onMove={moveTodoToDate}
              />
            </div>
          </section>

          <UnscheduledTodoPanel
            onMove={(todoId) => moveTodoToDate(todoId)}
            onOpen={(todo) => {
              setWorkflowError('');
              setModalRequest({ kind: 'update', todo });
            }}
            todos={unscheduledTodos}
          />
        </div>
      )}

      <TodoModalCoordinator
        createItem={createItem}
        createItems={createItems}
        onRequestChange={setModalRequest}
        onWorkflowError={setWorkflowError}
        request={modalRequest}
        updateItem={updateItem}
      />
    </main>
  );
}
