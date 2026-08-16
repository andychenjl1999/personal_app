'use client';

import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { dateKeyToUnixSeconds, dateToDateKey } from './todo-date';
import type { CreateTodoInput, Todo } from './todo-data';

type SpeechRecognitionController = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  abort: () => void;
  start: () => void;
  stop: () => void;
  onend: ((event: Event) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onstart: ((event: Event) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionController;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type VoiceTodoButtonProps = {
  onCreate: (input: CreateTodoInput) => Promise<Todo>;
  onRecognitionError: (message: string) => void;
};

type VoicePhase =
  | 'checking'
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'saving'
  | 'success'
  | 'unsupported';

type InteractionMode = 'tap' | 'hold';

const holdDelayMilliseconds = 300;
const successDurationMilliseconds = 2000;

const phaseLabels: Record<VoicePhase, string> = {
  checking: 'Voice todo',
  idle: 'Voice todo',
  listening: 'Listening…',
  transcribing: 'Transcribing…',
  saving: 'Adding…',
  success: 'Added today',
  unsupported: 'Voice unavailable',
};

function getRecognitionErrorMessage(error: SpeechRecognitionErrorCode) {
  switch (error) {
    case 'audio-capture':
      return 'No microphone is available. Connect or enable a microphone and try again.';
    case 'language-not-supported':
      return 'English (United States) voice recognition is not supported by this browser.';
    case 'network':
      return 'Voice recognition could not connect. Check your network and try again.';
    case 'no-speech':
      return 'No speech was detected. Try voice input again.';
    case 'not-allowed':
      return 'Microphone access is blocked. Allow microphone access in your browser and try again.';
    case 'service-not-allowed':
      return 'Voice recognition is blocked by this browser. Check its voice and privacy settings.';
    case 'aborted':
      return 'Voice input was interrupted. Try again.';
    default:
      return 'Voice input failed. Try again.';
  }
}

function MicrophoneIcon() {
  return (
    <svg
      aria-hidden="true"
      className="voice-todo-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 15.25a3.75 3.75 0 0 0 3.75-3.75V6.75a3.75 3.75 0 0 0-7.5 0v4.75A3.75 3.75 0 0 0 12 15.25Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M5.75 10.75v.75a6.25 6.25 0 0 0 12.5 0v-.75M12 17.75v3M9.25 20.75h5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function VoiceTodoButton({
  onCreate,
  onRecognitionError,
}: VoiceTodoButtonProps) {
  const [phase, setPhase] = useState<VoicePhase>('checking');
  const phaseRef = useRef<VoicePhase>('checking');
  const recognitionConstructorRef = useRef<
    SpeechRecognitionConstructor | undefined
  >(undefined);
  const recognitionRef = useRef<SpeechRecognitionController | undefined>(
    undefined,
  );
  const interactionModeRef = useRef<InteractionMode | undefined>(undefined);
  const activePointerIdRef = useRef<number | undefined>(undefined);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const finalTranscriptRef = useRef('');
  const recognitionStartedRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const recognitionErrorRef = useRef(false);
  const recognitionCancelledRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const isMountedRef = useRef(true);

  function changePhase(nextPhase: VoicePhase) {
    phaseRef.current = nextPhase;
    if (isMountedRef.current) {
      setPhase(nextPhase);
    }
  }

  function clearHoldTimeout() {
    if (holdTimeoutRef.current !== undefined) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = undefined;
    }
  }

  function clearSuccessTimeout() {
    if (successTimeoutRef.current !== undefined) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = undefined;
    }
  }

  function resetRecognitionState() {
    recognitionRef.current = undefined;
    interactionModeRef.current = undefined;
    finalTranscriptRef.current = '';
    recognitionStartedRef.current = false;
    stopRequestedRef.current = false;
    recognitionErrorRef.current = false;
    recognitionCancelledRef.current = false;
  }

  function failAndAbortRecognition(
    recognition: SpeechRecognitionController,
    message: string,
  ) {
    recognitionErrorRef.current = true;
    onRecognitionError(message);
    changePhase('transcribing');

    try {
      recognition.abort();
    } catch {
      resetRecognitionState();
      changePhase('idle');
    }
  }

  async function createTodoFromTranscript(transcript: string) {
    changePhase('saving');

    try {
      // Resolve today when recognition finishes so a capture spanning local midnight is
      // scheduled on the day that is current when the todo is actually persisted.
      await onCreate({
        title: transcript,
        dueDate: dateKeyToUnixSeconds(dateToDateKey(new Date())),
      });

      if (!isMountedRef.current) {
        return;
      }

      changePhase('success');
      clearSuccessTimeout();
      successTimeoutRef.current = setTimeout(() => {
        changePhase('idle');
        successTimeoutRef.current = undefined;
      }, successDurationMilliseconds);
    } catch {
      // useTodoCollection already exposes the exact persistence error in the shared banner.
      // Returning to idle keeps voice capture retryable without masking that backend error.
      changePhase('idle');
    }
  }

  function finishRecognition() {
    const transcript = finalTranscriptRef.current.trim();
    const hadError = recognitionErrorRef.current;
    const wasCancelled = recognitionCancelledRef.current;

    resetRecognitionState();

    if (wasCancelled || hadError) {
      changePhase('idle');
      return;
    }

    if (!transcript) {
      onRecognitionError('No speech was detected. Try voice input again.');
      changePhase('idle');
      return;
    }

    void createTodoFromTranscript(transcript);
  }

  function startListening(mode: InteractionMode) {
    if (phaseRef.current !== 'idle') {
      return;
    }

    const Recognition = recognitionConstructorRef.current;
    if (!Recognition) {
      changePhase('unsupported');
      return;
    }

    clearSuccessTimeout();
    onRecognitionError('');
    finalTranscriptRef.current = '';
    recognitionStartedRef.current = false;
    stopRequestedRef.current = false;
    recognitionErrorRef.current = false;
    recognitionCancelledRef.current = false;
    interactionModeRef.current = mode;

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      recognitionStartedRef.current = true;

      // A user can release a hold or tap Stop while the browser is still resolving its
      // first permission prompt. Honor that stop as soon as capture actually begins.
      try {
        if (recognitionCancelledRef.current) {
          recognition.abort();
        } else if (stopRequestedRef.current) {
          recognition.stop();
        }
      } catch {
        failAndAbortRecognition(
          recognition,
          'Voice input could not stop cleanly. Try again.',
        );
      }
    };

    recognition.onresult = (event) => {
      const transcriptParts: string[] = [];

      // Read the complete result list rather than only resultIndex so repeated result
      // events cannot append the same recognized words more than once.
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal && result.length > 0) {
          transcriptParts.push(result[0].transcript);
        }
      }

      finalTranscriptRef.current = transcriptParts.join(' ');
    };

    recognition.onerror = (event) => {
      if (
        event.error === 'aborted' &&
        (recognitionCancelledRef.current || recognitionErrorRef.current)
      ) {
        return;
      }

      recognitionErrorRef.current = true;
      onRecognitionError(getRecognitionErrorMessage(event.error));
      changePhase('transcribing');
    };

    recognition.onend = () => {
      finishRecognition();
    };

    recognitionRef.current = recognition;
    changePhase('listening');

    try {
      recognition.start();
    } catch {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      resetRecognitionState();
      onRecognitionError('Voice input could not start. Try again.');
      changePhase('idle');
    }
  }

  function stopListening() {
    const recognition = recognitionRef.current;
    if (!recognition || phaseRef.current !== 'listening') {
      return;
    }

    stopRequestedRef.current = true;
    changePhase('transcribing');

    if (recognitionStartedRef.current) {
      try {
        // stop() asks the browser to return a result for captured audio; abort() is
        // reserved for cancellation where a partial todo would be surprising.
        recognition.stop();
      } catch {
        failAndAbortRecognition(
          recognition,
          'Voice input could not stop cleanly. Try again.',
        );
      }
    }
  }

  function cancelListening() {
    clearHoldTimeout();
    suppressNextClickRef.current = false;
    activePointerIdRef.current = undefined;

    const recognition = recognitionRef.current;
    if (!recognition || interactionModeRef.current !== 'hold') {
      return;
    }

    recognitionCancelledRef.current = true;
    changePhase('transcribing');

    try {
      recognition.abort();
    } catch {
      resetRecognitionState();
      changePhase('idle');
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (
      phaseRef.current !== 'idle' ||
      (event.pointerType === 'mouse' && event.button !== 0)
    ) {
      return;
    }

    clearHoldTimeout();
    activePointerIdRef.current = event.pointerId;
    const pointerId = event.pointerId;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; document-level pointer delivery still lets a
      // normal tap work in browsers that reject capture for this device.
    }

    holdTimeoutRef.current = setTimeout(() => {
      if (
        activePointerIdRef.current === pointerId &&
        phaseRef.current === 'idle'
      ) {
        suppressNextClickRef.current = true;
        startListening('hold');
      }

      holdTimeoutRef.current = undefined;
    }, holdDelayMilliseconds);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    clearHoldTimeout();
    activePointerIdRef.current = undefined;

    if (interactionModeRef.current === 'hold') {
      stopListening();
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleClick() {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    if (phaseRef.current === 'idle') {
      startListening('tap');
    } else if (
      phaseRef.current === 'listening' &&
      interactionModeRef.current === 'tap'
    ) {
      stopListening();
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    const speechWindow = window as SpeechRecognitionWindow;
    recognitionConstructorRef.current =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    changePhase(
      recognitionConstructorRef.current === undefined ? 'unsupported' : 'idle',
    );

    return () => {
      isMountedRef.current = false;
      clearHoldTimeout();
      clearSuccessTimeout();

      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;

        try {
          recognition.abort();
        } catch {
          // The browser may already have disconnected the recognition service.
        }
      }

      recognitionRef.current = undefined;
    };
  }, []);

  const isListening = phase === 'listening';
  const isProcessing = phase === 'transcribing' || phase === 'saving';
  const isDisabled =
    phase === 'checking' ||
    phase === 'transcribing' ||
    phase === 'saving' ||
    phase === 'success' ||
    phase === 'unsupported';

  return (
    <button
      aria-label={
        phase === 'unsupported'
          ? 'Voice input is unavailable in this browser'
          : phaseLabels[phase]
      }
      aria-pressed={isListening}
      className={`button button-secondary voice-todo-button${
        isListening ? ' is-listening' : ''
      }${isProcessing ? ' is-processing' : ''}${
        phase === 'success' ? ' is-success' : ''
      }`}
      disabled={isDisabled}
      onClick={handleClick}
      onContextMenu={(event) => event.preventDefault()}
      onPointerCancel={cancelListening}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      title={
        phase === 'unsupported'
          ? 'Voice input is not supported by this browser.'
          : 'Tap to start or stop. Hold to record until release.'
      }
      type="button"
    >
      <MicrophoneIcon />
      <span aria-live="polite">{phaseLabels[phase]}</span>
    </button>
  );
}
