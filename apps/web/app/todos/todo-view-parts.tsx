'use client';

import { DragEvent, useState } from 'react';

import { Todo } from './todo-data';

const todoDragType = 'application/x-personal-todo-id';

export function getDraggedTodoId(event: DragEvent) {
  return (
    event.dataTransfer.getData(todoDragType) ||
    event.dataTransfer.getData('text/plain')
  );
}

export function sortTodosForDisplay(todos: Todo[]) {
  return [...todos].sort((first, second) => {
    const orderDifference =
      (first.dailyExecutionOrder ?? Number.MAX_SAFE_INTEGER) -
      (second.dailyExecutionOrder ?? Number.MAX_SAFE_INTEGER);

    if (orderDifference !== 0) {
      return orderDifference;
    }

    // This fallback keeps legacy rows deterministic if the UI loads before the ordering
    // migration has normalized every scheduled todo.
    const createdAtDifference = second.createdAt.localeCompare(first.createdAt);
    return createdAtDifference || first.id.localeCompare(second.id);
  });
}

function sortUnscheduledTodos(todos: Todo[]) {
  return [...todos].sort((first, second) => {
    const createdAtDifference = second.createdAt.localeCompare(first.createdAt);
    return createdAtDifference || first.id.localeCompare(second.id);
  });
}

export type TodoDropEdge = 'before' | 'after';

type TodoTitleItemProps = {
  todo: Todo;
  onOpen: (todo: Todo) => void;
  onDropAt?: (draggedTodoId: string, edge: TodoDropEdge) => void;
};

export function TodoTitleItem({ todo, onOpen, onDropAt }: TodoTitleItemProps) {
  const [dropEdge, setDropEdge] = useState<TodoDropEdge>();

  function getDropEdge(event: DragEvent<HTMLButtonElement>): TodoDropEdge {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
  }

  return (
    <button
      className={`todo-title-item${dropEdge ? ` is-drop-${dropEdge}` : ''}`}
      data-priority={todo.priority}
      data-status={todo.status}
      draggable
      onClick={(event) => {
        event.stopPropagation();
        onOpen(todo);
      }}
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(todoDragType, todo.id);
        event.dataTransfer.setData('text/plain', todo.id);
      }}
      onDragEnd={() => setDropEdge(undefined)}
      onDragEnter={
        onDropAt
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              setDropEdge(getDropEdge(event));
            }
          : undefined
      }
      onDragLeave={
        onDropAt
          ? (event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              ) {
                setDropEdge(undefined);
              }
            }
          : undefined
      }
      onDragOver={
        onDropAt
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = 'move';
              setDropEdge(getDropEdge(event));
            }
          : undefined
      }
      onDrop={
        onDropAt
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              const draggedTodoId = getDraggedTodoId(event);
              const resolvedDropEdge = dropEdge ?? getDropEdge(event);
              setDropEdge(undefined);

              if (draggedTodoId && draggedTodoId !== todo.id) {
                onDropAt(draggedTodoId, resolvedDropEdge);
              }
            }
          : undefined
      }
      title={`Edit ${todo.title}`}
      type="button"
    >
      {todo.title}
    </button>
  );
}

type UnscheduledTodoPanelProps = {
  todos: Todo[];
  onOpen: (todo: Todo) => void;
  onMove: (todoId: string) => void;
};

export function UnscheduledTodoPanel({
  todos,
  onOpen,
  onMove,
}: UnscheduledTodoPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const sortedTodos = sortUnscheduledTodos(todos);

  return (
    <aside
      className={`unscheduled-panel${isDragOver ? ' is-drag-over' : ''}`}
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
        setIsDragOver(false);
        const todoId = getDraggedTodoId(event);
        if (todoId) {
          onMove(todoId);
        }
      }}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Anytime</p>
          <h2>Unscheduled</h2>
        </div>
        <span className="count-badge">{todos.length}</span>
      </div>
      <p className="panel-description">
        Drag a task here to clear its execution date.
      </p>
      <div className="unscheduled-list">
        {sortedTodos.length ? (
          sortedTodos.map((todo) => (
            <TodoTitleItem key={todo.id} onOpen={onOpen} todo={todo} />
          ))
        ) : (
          <p className="drop-empty">
            Drop tasks here to leave them unscheduled.
          </p>
        )}
      </div>
    </aside>
  );
}

export function TodoErrorBanner({
  error,
  onDismiss,
}: {
  error: string;
  onDismiss: () => void;
}) {
  if (!error) {
    return null;
  }

  return (
    <div className="error-banner" role="alert">
      <span>{error}</span>
      <button aria-label="Dismiss error" onClick={onDismiss} type="button">
        ×
      </button>
    </div>
  );
}

export function TodoLoadingState() {
  return (
    <div aria-live="polite" className="loading-state">
      <span className="loading-spinner" />
      Loading your todos…
    </div>
  );
}
