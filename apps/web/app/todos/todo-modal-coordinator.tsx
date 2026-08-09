'use client';

import { useState } from 'react';

import { saveTodoDraftInput } from './todo-draft-data';
import {
  DraftTodoLine,
  removeDraftTodoLine,
  shiftDraftTodoLinesAfterRemoval,
} from './draft-todo-lines';
import { DraftTodoModal } from './draft-todo-modal';
import { RecurringTodoModal } from './recurring-todo-modal';
import { CreateTodoInput, Todo, UpdateTodoInput } from './todo-data';
import { TodoModal } from './todo-modal';

export type TodoModalRequest =
  | {
      kind: 'create';
      defaultDate?: string;
      defaultDailyExecutionOrder?: number;
      lockExecutionDate?: boolean;
    }
  | { kind: 'update'; todo: Todo }
  | { kind: 'draft' }
  | { kind: 'recurring'; defaultStartDate?: string }
  | null;

type DraftConversion = {
  content: string;
  lines: DraftTodoLine[];
  currentNumber: number;
  total: number;
};

type TodoModalCoordinatorProps = {
  request: TodoModalRequest;
  onRequestChange: (request: TodoModalRequest) => void;
  onWorkflowError: (message: string) => void;
  createItem: (
    input: CreateTodoInput,
    dailyExecutionOrder?: number,
  ) => Promise<Todo>;
  createItems: (inputs: CreateTodoInput[]) => Promise<Todo[]>;
  updateItem: (todoId: string, updates: UpdateTodoInput) => Promise<Todo>;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function TodoModalCoordinator({
  request,
  onRequestChange,
  onWorkflowError,
  createItem,
  createItems,
  updateItem,
}: TodoModalCoordinatorProps) {
  const [conversion, setConversion] = useState<DraftConversion>();

  function closeWorkflow() {
    setConversion(undefined);
    onRequestChange(null);
  }

  function startConversion(content: string, lines: DraftTodoLine[]) {
    if (lines.length === 0) {
      return;
    }

    setConversion({
      content,
      lines,
      currentNumber: 1,
      total: lines.length,
    });
    // Draft conversions intentionally start unassigned, even when launched from a day view.
    onRequestChange({ kind: 'create' });
  }

  async function handleTodoSubmit(input: CreateTodoInput) {
    if (request?.kind === 'update') {
      await updateItem(request.todo.id, input);
      closeWorkflow();
      return;
    }

    await createItem(
      input,
      request?.kind === 'create'
        ? request.defaultDailyExecutionOrder
        : undefined,
    );

    if (!conversion) {
      closeWorkflow();
      return;
    }

    const [convertedLine, ...remainingLines] = conversion.lines;
    const remainingContent = removeDraftTodoLine(
      conversion.content,
      convertedLine,
    );

    try {
      const savedDraft = await saveTodoDraftInput(remainingContent);
      const shiftedLines = shiftDraftTodoLinesAfterRemoval(
        remainingLines,
        convertedLine.lineIndex,
      );

      if (shiftedLines.length === 0) {
        closeWorkflow();
        return;
      }

      setConversion({
        content: savedDraft.content,
        lines: shiftedLines,
        currentNumber: conversion.currentNumber + 1,
        total: conversion.total,
      });
    } catch (error) {
      // Creation already succeeded, so stop instead of allowing a retry that could duplicate the todo.
      closeWorkflow();
      const reason = getErrorMessage(
        error,
        'The saved draft could not be updated.',
      );
      onWorkflowError(
        `Todo “${convertedLine.title}” was created, but its draft line could not be removed. Remove it manually before converting again. ${reason}`,
      );
    }
  }

  async function handleRecurringTodoSubmit(inputs: CreateTodoInput[]) {
    await createItems(inputs);
    closeWorkflow();
  }

  if (!request) {
    return null;
  }

  if (request.kind === 'draft') {
    return (
      <DraftTodoModal onClose={closeWorkflow} onConvert={startConversion} />
    );
  }

  if (request.kind === 'recurring') {
    return (
      <RecurringTodoModal
        defaultStartDate={request.defaultStartDate}
        onClose={closeWorkflow}
        onSubmit={handleRecurringTodoSubmit}
      />
    );
  }

  const currentDraftLine = conversion?.lines[0];
  const modalKey =
    request.kind === 'update'
      ? `update-${request.todo.id}`
      : currentDraftLine
        ? `draft-${conversion.currentNumber}-${currentDraftLine.lineIndex}`
        : `create-${request.defaultDate ?? 'unassigned'}-${request.defaultDailyExecutionOrder ?? 'append'}`;

  return (
    <TodoModal
      contextLabel={
        conversion
          ? `Draft todo ${conversion.currentNumber} of ${conversion.total}`
          : undefined
      }
      defaultDate={request.kind === 'create' ? request.defaultDate : undefined}
      defaultTitle={currentDraftLine?.title}
      key={modalKey}
      lockExecutionDate={
        request.kind === 'create' ? request.lockExecutionDate : undefined
      }
      onClose={closeWorkflow}
      onSubmit={handleTodoSubmit}
      submitLabel={
        conversion && conversion.currentNumber < conversion.total
          ? 'Create & continue'
          : undefined
      }
      todo={request.kind === 'update' ? request.todo : undefined}
    />
  );
}
