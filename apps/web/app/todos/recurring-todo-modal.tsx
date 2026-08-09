'use client';

import { FormEvent, useEffect, useState } from 'react';

import { dateKeyToUnixSeconds, dateToDateKey } from './todo-date';
import { CreateTodoInput } from './todo-data';
import {
  buildRecurringTodoDateKeys,
  getRecurringTodoValidationError,
  RecurrenceEnd,
  recurrenceEndOptions,
  RecurrenceUnit,
} from './recurring-todo';

type RecurringTodoModalProps = {
  defaultStartDate?: string;
  onClose: () => void;
  onSubmit: (inputs: CreateTodoInput[]) => Promise<void>;
};

const recurrenceUnitOptions: Array<{
  value: RecurrenceUnit;
  label: string;
}> = [
  { value: 'day', label: 'Calendar days' },
  { value: 'weekday', label: 'Weekdays' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
  { value: 'year', label: 'Years' },
];

export function RecurringTodoModal({
  defaultStartDate,
  onClose,
  onSubmit,
}: RecurringTodoModalProps) {
  const [minimumStartDate] = useState(() => dateToDateKey(new Date()));
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(
    defaultStartDate ?? minimumStartDate,
  );
  const [interval, setInterval] = useState('1');
  const [unit, setUnit] = useState<RecurrenceUnit>('day');
  const [end, setEnd] = useState<RecurrenceEnd>('3-months');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const schedule = {
    startDate,
    interval: Number(interval),
    unit,
    end,
  };
  const scheduleError = getRecurringTodoValidationError(
    schedule,
    minimumStartDate,
  );
  const occurrenceDateKeys = scheduleError
    ? []
    : buildRecurringTodoDateKeys(schedule, minimumStartDate);
  const occurrenceCount = occurrenceDateKeys.length;

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
      setError('Add a title before creating recurring todos.');
      return;
    }

    if (scheduleError) {
      setError(scheduleError);
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const inputs = occurrenceDateKeys.map((dateKey) => {
        const dueDate = dateKeyToUnixSeconds(dateKey);
        if (dueDate === undefined) {
          throw new Error(`Unable to convert recurrence date ${dateKey}.`);
        }

        // Only title and date are supplied so every occurrence receives the same defaults
        // as a normal newly scheduled todo and remains independently editable afterward.
        return { title: trimmedTitle, dueDate } satisfies CreateTodoInput;
      });

      await onSubmit(inputs);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to create recurring todos.',
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
        aria-labelledby="recurring-todo-modal-title"
        aria-modal="true"
        className="todo-modal"
        role="dialog"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">Recurring task</p>
            <h2 id="recurring-todo-modal-title">Create recurring todos</h2>
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

          <label className="field">
            <span>Start date</span>
            <input
              min={minimumStartDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
              type="date"
              value={startDate}
            />
          </label>

          <label className="field">
            <span>Until</span>
            <select
              onChange={(event) => setEnd(event.target.value as RecurrenceEnd)}
              value={end}
            >
              {recurrenceEndOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Every</span>
            <input
              inputMode="numeric"
              min={1}
              onChange={(event) => setInterval(event.target.value)}
              required
              step={1}
              type="number"
              value={interval}
            />
          </label>

          <label className="field">
            <span>Frequency</span>
            <select
              onChange={(event) =>
                setUnit(event.target.value as RecurrenceUnit)
              }
              value={unit}
            >
              {recurrenceUnitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {scheduleError ? (
            <p className="form-error field-wide" role="alert">
              {scheduleError}
            </p>
          ) : (
            <p className="recurrence-summary field-wide" aria-live="polite">
              This will create {occurrenceCount}{' '}
              {occurrenceCount === 1 ? 'todo' : 'todos'} from{' '}
              {occurrenceDateKeys[0]} through{' '}
              {occurrenceDateKeys[occurrenceDateKeys.length - 1]}.
            </p>
          )}

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
            <button
              className="button button-primary"
              disabled={isSaving || Boolean(scheduleError)}
              type="submit"
            >
              {isSaving
                ? 'Creating…'
                : `Create ${occurrenceCount} ${occurrenceCount === 1 ? 'todo' : 'todos'}`}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
