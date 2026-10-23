import { FALLBACK_TASK } from './focusPrompt';

export const VOICE_LABEL = 'Voice';
export const VOICE_MIC_LABEL = 'Mic';
export const VOICE_LISTENING = 'Listening';
export const VOICE_NOT_SETUP = "Voice isn't set up yet";
export const VOICE_MIC_DENIED = 'Mic access is off. Allow it in the browser, or type instead.';
export const VOICE_NO_SPEECH = "I didn't catch that. Hold V and try again.";
export const VOICE_REPEAT = 'Say that again?';
export const VOICE_TYPED = 'Type what you wanted instead.';
export const VOICE_NOISY = "It's noisy. Hold V closer, or type instead.";
export const VOICE_OFFLINE = "Voice didn't connect. Type instead.";
export const VOICE_CANCEL = 'Cancel';
export const VOICE_YES = 'Yes';
export const VOICE_NO = 'No';
export const VOICE_USE_TYPED = 'Start';
export const VOICE_CONFIRM_MS = 3000;

export type VoiceErrorKind = 'not-setup' | 'denied' | 'no-speech' | 'noisy' | 'offline';

export function voiceErrorCopy(kind: VoiceErrorKind): string {
  switch (kind) {
    case 'not-setup':
      return VOICE_NOT_SETUP;
    case 'denied':
      return VOICE_MIC_DENIED;
    case 'no-speech':
      return VOICE_NO_SPEECH;
    case 'noisy':
      return VOICE_NOISY;
    case 'offline':
      return VOICE_OFFLINE;
  }
}

export function formatVoiceConfirm(minutes: number, label: string): string {
  const name = label.trim() || FALLBACK_TASK;
  return `Starting ${Math.round(minutes)}m on ${name}`;
}

export function parseVoiceQuery(value: string | null | undefined): 'mock' | null {
  return value === 'mock' ? 'mock' : null;
}
