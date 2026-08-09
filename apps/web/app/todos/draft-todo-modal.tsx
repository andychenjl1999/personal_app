'use client';

import { useEffect, useMemo, useState } from 'react';

import { getTodoDraftInput, saveTodoDraftInput } from './todo-draft-data';
import { DraftTodoLine, getDraftTodoLines } from './draft-todo-lines';

type DraftTodoModalProps = {
  onClose: () => void;
  onConvert: (content: string, lines: DraftTodoLine[]) => void;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function DraftTodoModal({ onClose, onConvert }: DraftTodoModalProps) {
  const [content, setContent] = useState('');
  const [savedAt, setSavedAt] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const draftLines = useMemo(() => getDraftTodoLines(content), [content]);

  useEffect(() => {
    let isCurrentLoad = true;

    async function loadDraft() {
      try {
        const savedDraft = await getTodoDraftInput();
        if (isCurrentLoad) {
          setContent(savedDraft?.content ?? '');
          setSavedAt(savedDraft?.updatedAt);
          setLoadError('');
        }
      } catch (error) {
        if (isCurrentLoad) {
          setLoadError(
            getErrorMessage(error, 'Unable to load the saved draft.'),
          );
        }
      } finally {
        if (isCurrentLoad) {
          setIsLoading(false);
        }
      }
    }

    void loadDraft();

    return () => {
      isCurrentLoad = false;
    };
  }, []);

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

  async function persistDraft() {
    setIsSaving(true);
    setActionError('');

    try {
      const savedDraft = await saveTodoDraftInput(content);
      setContent(savedDraft.content);
      setSavedAt(savedDraft.updatedAt);
      return savedDraft;
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to save the draft.'));
      return undefined;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConvert() {
    if (draftLines.length === 0) {
      setActionError('Add at least one todo line before converting.');
      return;
    }

    // Save exactly what is visible before handing the durable buffer to the conversion sequence.
    const savedDraft = await persistDraft();
    if (!savedDraft) {
      return;
    }

    onConvert(savedDraft.content, getDraftTodoLines(savedDraft.content));
  }

  const isDisabled = isLoading || isSaving || Boolean(loadError);

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
        aria-labelledby="draft-todo-modal-title"
        aria-modal="true"
        className="todo-modal draft-todo-modal"
        role="dialog"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">Quick capture</p>
            <h2 id="draft-todo-modal-title">Draft todo items</h2>
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

        <div className="draft-todo-form">
          <div className="draft-todo-intro">
            <p>Write one rough todo per line, then review each one in turn.</p>
            <span>
              {draftLines.length} {draftLines.length === 1 ? 'todo' : 'todos'}
              {' ready'}
            </span>
          </div>

          <label className="field">
            <span>Draft todo items</span>
            <textarea
              autoFocus
              disabled={isDisabled}
              onChange={(event) => setContent(event.target.value)}
              placeholder={
                'Book dentist appointment\nPlan weekend groceries\nReview monthly budget'
              }
              rows={12}
              value={isLoading ? 'Loading saved draft…' : content}
            />
          </label>

          {loadError || actionError ? (
            <p className="form-error" role="alert">
              {loadError || actionError}
            </p>
          ) : savedAt ? (
            <p className="draft-save-status">Saved {formatSavedAt(savedAt)}</p>
          ) : (
            <p className="draft-save-status">No saved draft yet.</p>
          )}

          <footer className="modal-actions draft-modal-actions">
            <button
              className="button button-secondary"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              Close
            </button>
            <button
              className="button button-secondary"
              disabled={isDisabled}
              onClick={() => void persistDraft()}
              type="button"
            >
              {isSaving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              className="button button-primary"
              disabled={isDisabled || draftLines.length === 0}
              onClick={() => void handleConvert()}
              type="button"
            >
              Convert todos
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}
