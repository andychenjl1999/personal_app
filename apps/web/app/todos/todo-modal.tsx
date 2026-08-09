'use client';

import { FormEvent, useEffect, useState } from 'react';

import {
  datetimeLocalToUnixSeconds,
  executionTimeToTimeInput,
  timeInputToExecutionTime,
  unixSecondsToDateKey,
  unixSecondsToDatetimeLocal,
  dateKeyToUnixSeconds,
} from './todo-date';
import { CreateTodoInput, Todo } from './todo-data';

type TodoModalProps = {
  todo?: Todo;
  defaultDate?: string;
  defaultTitle?: string;
  contextLabel?: string;
  submitLabel?: string;
  lockExecutionDate?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTodoInput) => Promise<void>;
};

export function TodoModal({
  todo,
  defaultDate,
  defaultTitle,
  contextLabel,
  submitLabel,
  lockExecutionDate = false,
  onClose,
  onSubmit,
}: TodoModalProps) {
  const [title, setTitle] = useState(todo?.title ?? defaultTitle ?? '');
  const [progressNote, setProgressNote] = useState(todo?.progressNote ?? '');
  const [isCompleted, setIsCompleted] = useState(todo?.status === 'completed');
  const [executionDate, setExecutionDate] = useState(
    unixSecondsToDateKey(todo?.dueDate) || defaultDate || '',
  );
  const [executionTime, setExecutionTime] = useState(
    executionTimeToTimeInput(todo?.executionTime),
  );
  const [reminderTime, setReminderTime] = useState(
    unixSecondsToDatetimeLocal(todo?.reminderTime),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSaving, onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError('Add a title before saving this todo.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Hidden internal fields are omitted so creates use their defaults and updates preserve saved values.
      await onSubmit({
        title: trimmedTitle,
        progressNote,
        status: isCompleted ? 'completed' : 'planned',
        dueDate: dateKeyToUnixSeconds(executionDate),
        executionTime: timeInputToExecutionTime(executionTime),
        reminderTime: datetimeLocalToUnixSeconds(reminderTime),
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to save this todo.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="todo-modal-title"
        aria-modal="true"
        className="todo-modal"
        role="dialog"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">
              {contextLabel ?? (todo ? 'Edit task' : 'New task')}
            </p>
            <h2 id="todo-modal-title">
              {todo ? 'Update todo item' : 'Create todo item'}
            </h2>
          </div>
          <button
            aria-label="Close modal"
            className="icon-button"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <form className="todo-modal-form" onSubmit={handleSubmit}>
          <label className="field field-wide">
            <span>Title</span>
            <input
              autoFocus
              maxLength={240}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs to get done?"
              required
              value={title}
            />
          </label>

          <label className="field field-wide">
            <span>
              Progress note <small>Optional</small>
            </span>
            <textarea
              onChange={(event) => setProgressNote(event.target.value)}
              placeholder="Add context, progress, or next steps"
              rows={4}
              value={progressNote}
            />
          </label>

          <label className="checkbox-field">
            <input
              checked={isCompleted}
              onChange={(event) => setIsCompleted(event.target.checked)}
              type="checkbox"
            />
            <span>Complete</span>
          </label>

          <label className="field">
            <span>
              Execution date{' '}
              <small>
                {lockExecutionDate ? 'Fixed to selected day' : 'Optional'}
              </small>
            </span>
            <input
              disabled={lockExecutionDate}
              onChange={(event) => setExecutionDate(event.target.value)}
              type="date"
              value={executionDate}
            />
          </label>

          <label className="field">
            <span>
              Execution time <small>Optional</small>
            </span>
            <input
              onChange={(event) => setExecutionTime(event.target.value)}
              type="time"
              value={executionTime}
            />
          </label>

          <label className="field">
            <span>
              Reminder time <small>Optional</small>
            </span>
            <input
              onChange={(event) => setReminderTime(event.target.value)}
              type="datetime-local"
              value={reminderTime}
            />
          </label>

          {error ? (
            <p className="form-error field-wide" role="alert">
              {error}
            </p>
          ) : null}

          <footer className="modal-actions field-wide">
            <button
              className="button button-secondary"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button className="button button-primary" disabled={isSaving}>
              {isSaving
                ? 'Saving…'
                : (submitLabel ?? (todo ? 'Save changes' : 'Create todo'))}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
