import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceMicButton, VoiceOverlay } from './VoiceOverlay';
import { VOICE_LISTENING, VOICE_MIC_LABEL, VOICE_NOT_SETUP } from '@/lib/voiceCopy';

afterEach(() => cleanup());

const noop = () => {};

describe('VoiceMicButton', () => {
  it('is large high-contrast text, not a pill, and not pinned over the wordmark', () => {
    render(
      <VoiceMicButton visible holding={false} onHoldStart={vi.fn()} onHoldEnd={vi.fn()} />
    );
    const mic = screen.getByTestId('voice-mic');
    expect(mic.textContent).toBe(VOICE_MIC_LABEL);
    expect(mic.className).toMatch(/type-whoop/);
    expect(mic.className).toMatch(/text-orb-text/);
    expect(mic.className).not.toMatch(/left-16/);
    expect(mic.className).not.toMatch(/rounded-full/);
    expect(mic.className).not.toMatch(/bg-white/);
  });
});

describe('VoiceOverlay', () => {
  it('shows listening, confirm, conflict, and error without pills or em dashes', () => {
    const { rerender } = render(
      <VoiceOverlay
        phase="listening"
        liveTranscript=""
        mock={false}
        mockInput=""
        onMockChange={noop}
        onMockSubmit={noop}
        pending={null}
        conflict={null}
        errorKind={null}
        repeatMessage=""
        typedInput=""
        onTypedChange={noop}
        onTypedSubmit={noop}
        onCancel={noop}
        onYes={noop}
        onNo={noop}
      />
    );
    expect(screen.getByTestId('voice-listening').textContent).toBe(VOICE_LISTENING);

    rerender(
      <VoiceOverlay
        phase="confirm"
        liveTranscript=""
        mock={false}
        mockInput=""
        onMockChange={noop}
        onMockSubmit={noop}
        pending={{ minutes: 40, label: 'Mercor application', adjusted: false }}
        conflict={null}
        errorKind={null}
        repeatMessage=""
        typedInput=""
        onTypedChange={noop}
        onTypedSubmit={noop}
        onCancel={vi.fn()}
        onYes={noop}
        onNo={noop}
      />
    );
    expect(screen.getByTestId('voice-confirm').textContent).toBe(
      'Starting 40m on Mercor application'
    );

    rerender(
      <VoiceOverlay
        phase="conflict"
        liveTranscript=""
        mock={false}
        mockInput=""
        onMockChange={noop}
        onMockSubmit={noop}
        pending={{ minutes: 40, label: 'docs', adjusted: false }}
        conflict={{
          reason: 'calendar',
          minutes: 30,
          prompt: 'You have 30 minutes before Standup. Do 30?',
        }}
        errorKind={null}
        repeatMessage=""
        typedInput=""
        onTypedChange={noop}
        onTypedSubmit={noop}
        onCancel={noop}
        onYes={vi.fn()}
        onNo={vi.fn()}
      />
    );
    expect(screen.getByTestId('voice-conflict').textContent).toBe(
      'You have 30 minutes before Standup. Do 30?'
    );

    rerender(
      <VoiceOverlay
        phase="error"
        liveTranscript=""
        mock={false}
        mockInput=""
        onMockChange={noop}
        onMockSubmit={noop}
        pending={null}
        conflict={null}
        errorKind="not-setup"
        repeatMessage=""
        typedInput=""
        onTypedChange={noop}
        onTypedSubmit={noop}
        onCancel={noop}
        onYes={noop}
        onNo={noop}
      />
    );
    const error = screen.getByTestId('voice-error');
    expect(error.textContent).toBe(VOICE_NOT_SETUP);
    expect(error.className).not.toMatch(/rounded-full/);
    expect(error.textContent).not.toMatch(/[—–]/);
  });
});
