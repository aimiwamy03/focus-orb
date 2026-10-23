'use client';

import { FormEvent } from 'react';
import {
  formatVoiceConfirm,
  VOICE_CANCEL,
  VOICE_LISTENING,
  VOICE_MIC_LABEL,
  VOICE_NO,
  VOICE_TYPED,
  VOICE_USE_TYPED,
  VOICE_YES,
  voiceErrorCopy,
  type VoiceErrorKind,
} from '@/lib/voiceCopy';
import type { VoiceConflict } from '@/lib/voiceConflict';
import type { VoicePending, VoicePhase } from '@/lib/useVoiceStart';

const heading = 'text-[length:var(--type-heading)] font-normal leading-snug text-orb-text';
const action =
  'min-h-[44px] bg-transparent text-[length:var(--type-heading)] text-orb-text hover:text-orb-dim';
const mockAction =
  'min-h-[44px] bg-transparent text-[length:var(--type-status)] text-orb-dim hover:text-orb-text';

export function VoiceMicButton({
  visible,
  holding,
  onHoldStart,
  onHoldEnd,
}: {
  visible: boolean;
  holding: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      data-testid="voice-mic"
      aria-label={VOICE_MIC_LABEL}
      aria-pressed={holding}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onHoldStart();
      }}
      onPointerUp={onHoldEnd}
      onPointerCancel={onHoldEnd}
      className="fixed top-4 left-16 z-40 min-h-[44px] px-2 text-[length:var(--type-chrome)] text-orb-text hover:text-orb-dim"
    >
      {VOICE_MIC_LABEL}
    </button>
  );
}

function VoiceMockField({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      data-testid="voice-mock"
      className="flex w-full max-w-md flex-col items-center gap-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <input
        data-testid="voice-mock-input"
        data-voice-field="true"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type a transcript"
        className="w-full bg-transparent text-center text-[length:var(--type-input)] text-orb-text outline-none placeholder:text-orb-placeholder"
      />
      <button type="submit" data-testid="voice-mock-submit" className={mockAction}>
        Use transcript
      </button>
    </form>
  );
}

export function VoiceOverlay({
  phase,
  liveTranscript,
  mock,
  mockInput,
  onMockChange,
  onMockSubmit,
  pending,
  conflict,
  errorKind,
  repeatMessage,
  typedInput,
  onTypedChange,
  onTypedSubmit,
  onCancel,
  onYes,
  onNo,
}: {
  phase: VoicePhase;
  liveTranscript: string;
  mock: boolean;
  mockInput: string;
  onMockChange: (value: string) => void;
  onMockSubmit: () => void;
  pending: VoicePending | null;
  conflict: VoiceConflict | null;
  errorKind: VoiceErrorKind | null;
  repeatMessage: string;
  typedInput: string;
  onTypedChange: (value: string) => void;
  onTypedSubmit: () => void;
  onCancel: () => void;
  onYes: () => void;
  onNo: () => void;
}) {
  const showMock = mock && (phase === 'repeat');
  const showOverlay = phase !== 'idle' || mock;

  if (!showOverlay) return null;

  if (phase === 'idle') {
    return (
      <div
        data-testid="voice-overlay"
        data-phase={phase}
        data-text-clear
        className="pointer-events-auto fixed bottom-6 left-6 z-50 w-[min(18rem,calc(100vw-3rem))]"
      >
        <VoiceMockField value={mockInput} onChange={onMockChange} onSubmit={onMockSubmit} />
      </div>
    );
  }

  return (
    <div
      data-testid="voice-overlay"
      data-phase={phase}
      data-text-clear
      className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 px-4 text-center"
    >
      <div className="flex w-[min(36rem,92vw)] flex-col items-center gap-5">
        {phase === 'listening' ? (
          <>
            <p data-testid="voice-listening" className={heading}>
              {VOICE_LISTENING}
            </p>
            {liveTranscript ? (
              <p data-testid="voice-live" className="text-[length:var(--type-input)] text-orb-dim">
                {liveTranscript}
              </p>
            ) : null}
          </>
        ) : null}

        {phase === 'confirm' && pending ? (
          <>
            <p data-testid="voice-confirm" className={heading}>
              {formatVoiceConfirm(pending.minutes, pending.label)}
            </p>
            <button type="button" data-testid="voice-cancel" className={action} onClick={onCancel}>
              {VOICE_CANCEL}
            </button>
          </>
        ) : null}

        {phase === 'conflict' && conflict ? (
          <>
            <p data-testid="voice-conflict" className={heading}>
              {conflict.prompt}
            </p>
            <div className="flex items-center gap-8">
              <button type="button" data-testid="voice-yes" className={action} onClick={onYes}>
                {VOICE_YES}
              </button>
              <button type="button" data-testid="voice-no" className={action} onClick={onNo}>
                {VOICE_NO}
              </button>
            </div>
          </>
        ) : null}

        {phase === 'repeat' ? (
          <p data-testid="voice-repeat" className={heading}>
            {repeatMessage}
          </p>
        ) : null}

        {phase === 'error' && errorKind ? (
          <p data-testid="voice-error" className={heading}>
            {voiceErrorCopy(errorKind)}
          </p>
        ) : null}

        {phase === 'typed' ? (
          <form
            className="flex w-full flex-col items-center gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              onTypedSubmit();
            }}
          >
            <p className={heading}>{VOICE_TYPED}</p>
            <input
              data-testid="voice-typed-input"
              data-voice-field="true"
              value={typedInput}
              onChange={(event) => onTypedChange(event.target.value)}
              className="w-full bg-transparent text-center text-[length:var(--type-input)] text-orb-text outline-none"
            />
            <button type="submit" data-testid="voice-typed-submit" className={action}>
              {VOICE_USE_TYPED}
            </button>
          </form>
        ) : null}

        {showMock ? (
          <VoiceMockField value={mockInput} onChange={onMockChange} onSubmit={onMockSubmit} />
        ) : null}
      </div>
    </div>
  );
}
