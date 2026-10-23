'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FALLBACK_TASK } from './focusPrompt';
import { track } from './track';
import { voiceConflict, type VoiceConflict } from './voiceConflict';
import {
  formatVoiceConfirm,
  parseVoiceQuery,
  VOICE_CONFIRM_MS,
  VOICE_NO_SPEECH,
  VOICE_NOISY,
  VOICE_REPEAT,
  VOICE_TYPED,
  type VoiceErrorKind,
} from './voiceCopy';
import {
  isLowConfidence,
  isNoisyTranscript,
  parseVoiceIntent,
} from './voiceIntent';
import { silenceVoice, speakVoice } from './voiceSpeak';
import { startLiveVoice, type VoiceTurn } from './voiceStream';

export type VoicePhase =
  | 'idle'
  | 'listening'
  | 'conflict'
  | 'confirm'
  | 'repeat'
  | 'typed'
  | 'error';

export type VoicePending = {
  minutes: number;
  label: string;
  adjusted: boolean;
};

export function isVoiceHoldKey(key: string): boolean {
  return key === 'v' || key === 'V';
}

export function voiceFieldTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('[data-voice-field="true"]'));
}

type LiveHandle = { stop: () => Promise<VoiceTurn> };

export function useVoiceStart(options: {
  enabled: boolean;
  mock: boolean;
  gapMinutes: number | null;
  nextEventTitle: string | null;
  whoopOfferMinutes: number | null;
  confirmMs?: number;
  onStart: (pending: VoicePending) => void;
}) {
  const optsRef = useRef(options);
  optsRef.current = options;
  const confirmMs = options.confirmMs ?? VOICE_CONFIRM_MS;

  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [mockInput, setMockInput] = useState('');
  const [typedInput, setTypedInput] = useState('');
  const [errorKind, setErrorKind] = useState<VoiceErrorKind | null>(null);
  const [repeatMessage, setRepeatMessage] = useState(VOICE_REPEAT);
  const [pending, setPending] = useState<VoicePending | null>(null);
  const [conflict, setConflict] = useState<VoiceConflict | null>(null);

  const phaseRef = useRef<VoicePhase>('idle');
  const pendingRef = useRef<VoicePending | null>(null);
  const conflictRef = useRef<VoiceConflict | null>(null);
  const askedRepeatRef = useRef(false);
  const holdingRef = useRef(false);
  const liveRef = useRef<LiveHandle | null>(null);
  const mockInputRef = useRef('');
  mockInputRef.current = mockInput;
  phaseRef.current = phase;
  pendingRef.current = pending;
  conflictRef.current = conflict;

  const resetIdle = useCallback(() => {
    silenceVoice();
    setPhase('idle');
    phaseRef.current = 'idle';
    setLiveTranscript('');
    setPending(null);
    pendingRef.current = null;
    setConflict(null);
    conflictRef.current = null;
    setErrorKind(null);
    setTypedInput('');
    askedRepeatRef.current = false;
  }, []);

  const beginConfirm = useCallback(
    (next: VoicePending) => {
      silenceVoice();
      setConflict(null);
      conflictRef.current = null;
      setPending(next);
      pendingRef.current = next;
      setPhase('confirm');
      phaseRef.current = 'confirm';
      speakVoice(formatVoiceConfirm(next.minutes, next.label));
    },
    []
  );

  const acceptPending = useCallback(
    (next: VoicePending) => {
      optsRef.current.onStart(next);
      track({
        name: 'block_started_by_voice',
        minutes: next.minutes,
        adjusted: next.adjusted,
      });
      resetIdle();
    },
    [resetIdle]
  );

  const miss = useCallback((message: string, kind: VoiceErrorKind | null) => {
    if (!askedRepeatRef.current) {
      askedRepeatRef.current = true;
      setRepeatMessage(message);
      if (conflictRef.current) {
        setPhase('conflict');
        phaseRef.current = 'conflict';
      } else {
        setPhase('repeat');
        phaseRef.current = 'repeat';
      }
      speakVoice(message);
      return;
    }
    setConflict(null);
    conflictRef.current = null;
    setRepeatMessage(VOICE_TYPED);
    setTypedInput('');
    setErrorKind(kind);
    setPhase('typed');
    phaseRef.current = 'typed';
    speakVoice(VOICE_TYPED);
  }, []);

  const applyTranscript = useCallback(
    (raw: string, confidence: number | null) => {
      const text = raw.trim();

      if (conflictRef.current) {
        const intent = parseVoiceIntent(text || 'unknown');
        if (intent.kind === 'yes') {
          const offered = conflictRef.current;
          const label = pendingRef.current?.label || FALLBACK_TASK;
          beginConfirm({ minutes: offered.minutes, label, adjusted: true });
          return;
        }
        if (intent.kind === 'no' || intent.kind === 'cancel') {
          resetIdle();
          return;
        }
        miss(VOICE_REPEAT, null);
        return;
      }

      if (!text) {
        miss(VOICE_NO_SPEECH, 'no-speech');
        return;
      }
      if (isNoisyTranscript(text, confidence)) {
        miss(VOICE_NOISY, 'noisy');
        return;
      }
      if (isLowConfidence(confidence)) {
        miss(VOICE_REPEAT, null);
        return;
      }

      const intent = parseVoiceIntent(text);
      if (intent.kind === 'cancel') {
        resetIdle();
        return;
      }
      if (intent.kind === 'yes' || intent.kind === 'no' || intent.kind === 'unknown') {
        miss(VOICE_REPEAT, null);
        return;
      }

      const label = intent.label.trim() || FALLBACK_TASK;
      const found = voiceConflict({
        minutes: intent.minutes,
        gapMinutes: optsRef.current.gapMinutes,
        nextEventTitle: optsRef.current.nextEventTitle,
        whoopOfferMinutes: optsRef.current.whoopOfferMinutes,
      });
      const next: VoicePending = { minutes: intent.minutes, label, adjusted: false };
      if (found) {
        setPending(next);
        pendingRef.current = next;
        setConflict(found);
        conflictRef.current = found;
        setPhase('conflict');
        phaseRef.current = 'conflict';
        speakVoice(found.prompt);
        return;
      }
      beginConfirm(next);
    },
    [beginConfirm, miss, resetIdle]
  );

  const fail = useCallback((kind: VoiceErrorKind) => {
    silenceVoice();
    holdingRef.current = false;
    liveRef.current = null;
    setErrorKind(kind);
    setPhase('error');
    phaseRef.current = 'error';
  }, []);

  const holdStart = useCallback(() => {
    if (!optsRef.current.enabled) return;
    if (holdingRef.current) return;
    if (phaseRef.current === 'confirm') return;

    holdingRef.current = true;
    setLiveTranscript('');
    setErrorKind(null);
    setPhase('listening');
    phaseRef.current = 'listening';

    if (optsRef.current.mock) return;

    void (async () => {
      try {
        const handle = await startLiveVoice({
          onTurn: (turn) => setLiveTranscript(turn.transcript),
        });
        if (!holdingRef.current) {
          await handle.stop();
          return;
        }
        liveRef.current = handle;
      } catch (cause) {
        const kind =
          cause && typeof cause === 'object' && 'kind' in cause
            ? (cause as { kind?: VoiceErrorKind }).kind
            : 'offline';
        fail(kind === 'denied' || kind === 'not-setup' || kind === 'offline' ? kind : 'offline');
      }
    })();
  }, [fail]);

  const holdEnd = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    const mock = optsRef.current.mock;
    const live = liveRef.current;
    liveRef.current = null;

    void (async () => {
      if (mock) {
        applyTranscript(mockInputRef.current, 1);
        return;
      }
      if (!live) {
        if (phaseRef.current === 'listening') miss(VOICE_NO_SPEECH, 'no-speech');
        return;
      }
      try {
        const turn = await live.stop();
        applyTranscript(turn.transcript, turn.confidence);
      } catch {
        miss(VOICE_NO_SPEECH, 'no-speech');
      }
    })();
  }, [applyTranscript, miss]);

  useEffect(() => {
    if (phase !== 'confirm' || !pending) return;
    const timer = window.setTimeout(() => {
      const next = pendingRef.current;
      if (next) acceptPending(next);
    }, confirmMs);
    return () => window.clearTimeout(timer);
  }, [phase, pending, confirmMs, acceptPending]);

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (!optsRef.current.enabled) return;
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (!isVoiceHoldKey(event.key)) return;
      if (voiceFieldTarget(event.target)) return;
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      holdStart();
    };
    const onUp = (event: KeyboardEvent) => {
      if (!isVoiceHoldKey(event.key)) return;
      if (voiceFieldTarget(event.target) && !holdingRef.current) return;
      if (event.cancelable) event.preventDefault();
      holdEnd();
    };
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
    };
  }, [holdEnd, holdStart]);

  useEffect(() => {
    if (options.enabled) return;
    holdingRef.current = false;
    const live = liveRef.current;
    liveRef.current = null;
    if (live) void live.stop();
    resetIdle();
  }, [options.enabled, resetIdle]);

  useEffect(() => () => {
    silenceVoice();
    const live = liveRef.current;
    liveRef.current = null;
    if (live) void live.stop();
  }, []);

  return {
    mock: options.mock,
    phase,
    liveTranscript,
    mockInput,
    setMockInput,
    typedInput,
    setTypedInput,
    errorKind,
    repeatMessage,
    pending,
    conflict,
    holdStart,
    holdEnd,
    submitMock: () => applyTranscript(mockInputRef.current, 1),
    submitTyped: () => applyTranscript(typedInput, 1),
    cancelConfirm: resetIdle,
    conflictYes: () => {
      if (!conflictRef.current) return;
      beginConfirm({
        minutes: conflictRef.current.minutes,
        label: pendingRef.current?.label || FALLBACK_TASK,
        adjusted: true,
      });
    },
    conflictNo: resetIdle,
    dismissError: resetIdle,
  };
}

export { parseVoiceQuery };
