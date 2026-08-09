'use client';

import Link from 'next/link';
import { DragEvent, KeyboardEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  dateKeyToUnixSeconds,
  dateToDateKey,
  dateToMonthKey,
  formatMonth,
  getCalendarDateKeys,
  isMonthKey,
  shiftMonthKey,
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
  TodoErrorBanner,
  TodoLoadingState,
  TodoTitleItem,
  UnscheduledTodoPanel,
} from './todo-view-parts';
import { useTodoCollection } from './use-todo-collection';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TodoApp({ initialMonth }: { initialMonth?: string }) {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(() =>
    initialMonth && isMonthKey(initialMonth)
      ? initialMonth
      : dateToMonthKey(new Date()),
  );
  const [modalRequest, setModalRequest] = useState<TodoModalRequest>(null);
  const [workflowError, setWorkflowError] = useState('');
  const [dragOverDate, setDragOverDate] = useState<string>();
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
  const todayKey = dateToDateKey(new Date());
  const calendarDateKeys = useMemo(
    () => getCalendarDateKeys(monthKey),
    [monthKey],
  );
  const unscheduledTodos = todos.filter((todo) => todo.dueDate === undefined);
  const todosByDate = useMemo(() => {
    const groupedTodos = new Map<string, Todo[]>();

    for (const todo of todos) {
      if (todo.dueDate === undefined) {
        continue;
      }

      const dateKey = unixSecondsToDateKey(todo.dueDate);
      groupedTodos.set(dateKey, [...(groupedTodos.get(dateKey) ?? []), todo]);
    }

    return groupedTodos;
  }, [todos]);

  function moveTodoToDate(todoId: string, dateKey?: string) {
    void moveItem(todoId, dateKeyToUnixSeconds(dateKey)).catch(() => {
      // The collection hook restores the previous row and exposes the backend error.
    });
  }

  function handleDayKeyDown(
    event: KeyboardEvent<HTMLElement>,
    dateKey: string,
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      router.push(`/day/${dateKey}`);
    }
  }

  function handleDateDrop(event: DragEvent<HTMLElement>, dateKey: string) {
    event.preventDefault();
    event.stopPropagation();
    setDragOverDate(undefined);
    const todoId = getDraggedTodoId(event);
    if (todoId) {
      moveTodoToDate(todoId, dateKey);
    }
  }

  return (
    <main className="app-shell">
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
              setModalRequest({ kind: 'recurring' });
            }}
            type="button"
          >
            Recurring todo
          </button>
          <button
            className="button button-primary"
            onClick={() => {
              setWorkflowError('');
              setModalRequest({ kind: 'create' });
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

      <section className="calendar-toolbar">
        <div>
          <p className="eyebrow">Month view</p>
          <h1>{formatMonth(monthKey)}</h1>
        </div>
        <div className="toolbar-actions" aria-label="Calendar navigation">
          <button
            aria-label="Previous month"
            className="icon-button"
            onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))}
            type="button"
          >
            ←
          </button>
          <button
            className="button button-secondary"
            onClick={() => setMonthKey(dateToMonthKey(new Date()))}
            type="button"
          >
            Today
          </button>
          <button
            aria-label="Next month"
            className="icon-button"
            onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))}
            type="button"
          >
            →
          </button>
        </div>
      </section>

      {isLoading ? (
        <TodoLoadingState />
      ) : (
        <div className="calendar-layout">
          <section
            className="calendar-surface"
            aria-label={formatMonth(monthKey)}
          >
            <div className="weekday-row" aria-hidden="true">
              {weekdayLabels.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="month-grid">
              {calendarDateKeys.map((dateKey) => {
                const dayTodos = sortTodosForDisplay(
                  todosByDate.get(dateKey) ?? [],
                );
                const isOutsideMonth = !dateKey.startsWith(monthKey);
                const isToday = dateKey === todayKey;

                return (
                  <article
                    aria-label={`Open ${dateKey}`}
                    className={`calendar-day${
                      isOutsideMonth ? ' is-outside-month' : ''
                    }${isToday ? ' is-today' : ''}${
                      dragOverDate === dateKey ? ' is-drag-over' : ''
                    }`}
                    key={dateKey}
                    onClick={() => router.push(`/day/${dateKey}`)}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragOverDate(dateKey);
                    }}
                    onDragLeave={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node | null,
                        )
                      ) {
                        setDragOverDate(undefined);
                      }
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(event) => handleDateDrop(event, dateKey)}
                    onKeyDown={(event) => handleDayKeyDown(event, dateKey)}
                    role="link"
                    tabIndex={0}
                  >
                    <div className="day-number-row">
                      <time dateTime={dateKey}>
                        {Number(dateKey.slice(-2))}
                      </time>
                      {dayTodos.length ? (
                        <span className="day-count">{dayTodos.length}</span>
                      ) : null}
                    </div>
                    <div className="calendar-day-items">
                      {dayTodos.map((todo) => (
                        <TodoTitleItem
                          key={todo.id}
                          onOpen={(selectedTodo) => {
                            setWorkflowError('');
                            setModalRequest({
                              kind: 'update',
                              todo: selectedTodo,
                            });
                          }}
                          todo={todo}
                        />
                      ))}
                    </div>
                  </article>
                );
              })}
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
