'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  createTodo,
  createTodoAtDailyPosition,
  createTodos,
  CreateTodoInput,
  listTodos,
  moveTodoToDailyPosition,
  Todo,
  updateTodo,
  UpdateTodoInput,
} from './todo-data';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function compareStoredDailyOrder(first: Todo, second: Todo) {
  const orderDifference =
    (first.dailyExecutionOrder ?? Number.MAX_SAFE_INTEGER) -
    (second.dailyExecutionOrder ?? Number.MAX_SAFE_INTEGER);

  if (orderDifference !== 0) {
    return orderDifference;
  }

  const createdAtDifference = second.createdAt.localeCompare(first.createdAt);
  return createdAtDifference || first.id.localeCompare(second.id);
}

function buildOptimisticMove(
  currentTodos: Todo[],
  todoId: string,
  destinationDueDate?: number,
  destinationOrder?: number,
) {
  const movedTodo = currentTodos.find((todo) => todo.id === todoId);
  if (!movedTodo) {
    return currentTodos;
  }

  const sourceDueDate = movedTodo.dueDate;
  if (sourceDueDate === destinationDueDate && destinationOrder === undefined) {
    return currentTodos;
  }

  const movedTodoAtDestination: Todo = {
    ...movedTodo,
    dueDate: destinationDueDate,
    dailyExecutionOrder: undefined,
  };
  const optimisticTodos = currentTodos.map((todo) =>
    todo.id === todoId ? movedTodoAtDestination : { ...todo },
  );

  // The destination is ranked after removing the dragged todo, which keeps before/after
  // insertion correct when an item moves within its current day.
  if (destinationDueDate !== undefined) {
    const destinationTodos = optimisticTodos
      .filter(
        (todo) => todo.dueDate === destinationDueDate && todo.id !== todoId,
      )
      .sort(compareStoredDailyOrder);
    const insertionIndex =
      destinationOrder === undefined
        ? destinationTodos.length
        : Math.min(Math.max(destinationOrder - 1, 0), destinationTodos.length);

    destinationTodos.splice(insertionIndex, 0, movedTodoAtDestination);
    const destinationOrders = new Map(
      destinationTodos.map((todo, index) => [todo.id, index + 1]),
    );

    for (const todo of optimisticTodos) {
      const order = destinationOrders.get(todo.id);
      if (order !== undefined) {
        todo.dailyExecutionOrder = order;
      }
    }
  }

  if (sourceDueDate !== undefined && sourceDueDate !== destinationDueDate) {
    const sourceTodos = optimisticTodos
      .filter((todo) => todo.dueDate === sourceDueDate)
      .sort(compareStoredDailyOrder);

    for (const [index, todo] of sourceTodos.entries()) {
      todo.dailyExecutionOrder = index + 1;
    }
  }

  return optimisticTodos;
}

export function useTodoCollection() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrentLoad = true;

    async function loadTodos() {
      try {
        // Every mounted view performs its own read while sharing the same backend function.
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
          setIsLoading(false);
        }
      }
    }

    void loadTodos();

    return () => {
      isCurrentLoad = false;
    };
  }, []);

  const createItem = useCallback(
    async (input: CreateTodoInput, destinationOrder?: number) => {
      try {
        const shouldCreateAtPosition =
          destinationOrder !== undefined &&
          input.dueDate !== undefined &&
          (input.status ?? 'planned') !== 'completed';
        const createdTodo = shouldCreateAtPosition
          ? await createTodoAtDailyPosition(input, destinationOrder)
          : await createTodo(input);

        // Completed items remain persisted but never enter any visible web collection.
        if (createdTodo.status !== 'completed') {
          setTodos((currentTodos) => {
            const createdDueDate = createdTodo.dueDate;
            const createdOrder = createdTodo.dailyExecutionOrder;
            if (
              !shouldCreateAtPosition ||
              createdDueDate === undefined ||
              createdOrder === undefined
            ) {
              return [createdTodo, ...currentTodos];
            }

            // The RPC returns the created row only. Mirror its atomic database shift locally
            // so every existing item at or below the insertion point moves down immediately.
            const shiftedTodos = currentTodos.map((todo) =>
              todo.dueDate === createdDueDate &&
              todo.dailyExecutionOrder !== undefined &&
              todo.dailyExecutionOrder >= createdOrder
                ? {
                    ...todo,
                    dailyExecutionOrder: todo.dailyExecutionOrder + 1,
                  }
                : todo,
            );

            return [createdTodo, ...shiftedTodos];
          });
        }
        setError('');
        return createdTodo;
      } catch (createError) {
        const message = getErrorMessage(createError, 'Unable to create todo.');
        setError(message);
        throw new Error(message);
      }
    },
    [],
  );

  const createItems = useCallback(async (inputs: CreateTodoInput[]) => {
    try {
      const createdTodos = await createTodos(inputs);

      // Recurring creation uses ordinary planned todos, but retain the collection's hidden-
      // completed invariant if this shared batch path later receives broader create inputs.
      const visibleCreatedTodos = createdTodos.filter(
        (todo) => todo.status !== 'completed',
      );
      setTodos((currentTodos) => [...visibleCreatedTodos, ...currentTodos]);
      setError('');
      return createdTodos;
    } catch (createError) {
      const message = getErrorMessage(
        createError,
        'Unable to create recurring todos.',
      );
      setError(message);
      throw new Error(message);
    }
  }, []);

  const updateItem = useCallback(
    async (todoId: string, updates: UpdateTodoInput) => {
      try {
        const previousTodo = todos.find((todo) => todo.id === todoId);
        const savedTodo = await updateTodo(todoId, updates);
        setTodos((currentTodos) => {
          // Marking an item completed removes it immediately from every web view.
          if (savedTodo.status === 'completed') {
            return currentTodos.filter((todo) => todo.id !== todoId);
          }

          return currentTodos.map((todo) =>
            todo.id === todoId ? savedTodo : todo,
          );
        });

        const orderMayHaveChanged =
          previousTodo?.dueDate !== savedTodo.dueDate ||
          savedTodo.status === 'completed';

        if (orderMayHaveChanged) {
          try {
            // Date and completion triggers can compact rows that were not part of the modal
            // update response, so reload the collection after those less frequent mutations.
            setTodos(await listTodos());
          } catch (refreshError) {
            setError(
              getErrorMessage(
                refreshError,
                'Todo saved, but the updated daily order could not be loaded.',
              ),
            );
            return savedTodo;
          }
        }

        setError('');
        return savedTodo;
      } catch (updateError) {
        const message = getErrorMessage(updateError, 'Unable to update todo.');
        setError(message);
        throw new Error(message);
      }
    },
    [todos],
  );

  const moveItem = useCallback(
    async (
      todoId: string,
      destinationDueDate?: number,
      destinationOrder?: number,
    ) => {
      const previousTodos = todos;
      const optimisticTodos = buildOptimisticMove(
        previousTodos,
        todoId,
        destinationDueDate,
        destinationOrder,
      );

      if (optimisticTodos === previousTodos) {
        return;
      }

      // Date moves and within-day reorders settle immediately while Supabase atomically
      // updates every position in the source and destination lists.
      setTodos(optimisticTodos);

      try {
        const affectedTodos = await moveTodoToDailyPosition({
          todoId,
          destinationDueDate,
          destinationOrder,
        });
        const affectedTodosById = new Map(
          affectedTodos.map((todo) => [todo.id, todo]),
        );

        setTodos((currentTodos) =>
          currentTodos.map((todo) => affectedTodosById.get(todo.id) ?? todo),
        );
        setError('');
      } catch (moveError) {
        setTodos(previousTodos);
        const message = getErrorMessage(moveError, 'Unable to move todo.');
        setError(message);
        throw new Error(message);
      }
    },
    [todos],
  );

  return {
    todos,
    isLoading,
    error,
    clearError: () => setError(''),
    createItem,
    createItems,
    updateItem,
    moveItem,
  };
}
