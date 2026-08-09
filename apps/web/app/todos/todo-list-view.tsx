'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Todo } from './todo-data';
import {
  TodoModalCoordinator,
  TodoModalRequest,
} from './todo-modal-coordinator';
import { TodoErrorBanner, TodoLoadingState } from './todo-view-parts';
import { useTodoCollection } from './use-todo-collection';

type AllTodoRowProps = {
  todo: Todo;
  onComplete: (todoId: string) => Promise<Todo>;
  onOpen: (todo: Todo) => void;
};

function AllTodoRow({ todo, onComplete, onOpen }: AllTodoRowProps) {
  const [isCompleting, setIsCompleting] = useState(false);

  async function completeTodo() {
    setIsCompleting(true);

    try {
      await onComplete(todo.id);
    } catch {
      // The collection hook exposes the backend error. Restore the checkbox so the
      // item remains actionable when the completion request does not persist.
      setIsCompleting(false);
    }
  }

  return (
    <div className="all-todo-row">
      <label className="all-todo-complete">
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
      <button
        className="all-todo-title"
        onClick={() => onOpen(todo)}
        title={`Edit ${todo.title}`}
        type="button"
      >
        {todo.title}
      </button>
    </div>
  );
}

export function TodoListView() {
  const [modalRequest, setModalRequest] = useState<TodoModalRequest>(null);
  const [workflowError, setWorkflowError] = useState('');
  const {
    todos,
    isLoading,
    error,
    clearError,
    createItem,
    createItems,
    updateItem,
  } = useTodoCollection();

  return (
    <main className="app-shell todo-list-app-shell">
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
          <Link className="button button-secondary" href="/">
            Month view
          </Link>
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

      <section className="all-todos-toolbar">
        <div>
          <p className="eyebrow">List view</p>
          <h1>All incomplete todos</h1>
        </div>
        <span className="count-badge">{todos.length}</span>
      </section>

      {isLoading ? (
        <TodoLoadingState />
      ) : (
        <section className="all-todos-surface">
          {todos.length ? (
            <div className="all-todos-list">
              {todos.map((todo) => (
                <AllTodoRow
                  key={todo.id}
                  onComplete={(todoId) =>
                    updateItem(todoId, { status: 'completed' })
                  }
                  onOpen={(selectedTodo) => {
                    setWorkflowError('');
                    setModalRequest({ kind: 'update', todo: selectedTodo });
                  }}
                  todo={todo}
                />
              ))}
            </div>
          ) : (
            <div className="all-todos-empty">
              <span aria-hidden="true">✓</span>
              <strong>No incomplete todos</strong>
              <p>Everything on your list is complete.</p>
            </div>
          )}
        </section>
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
