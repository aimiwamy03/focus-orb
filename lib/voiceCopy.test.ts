import { describe, expect, it } from 'vitest';
import {
  formatVoiceConfirm,
  parseVoiceQuery,
  VOICE_LISTENING,
  VOICE_MIC_DENIED,
  VOICE_NOT_SETUP,
  VOICE_NO_SPEECH,
  VOICE_NOISY,
  VOICE_REPEAT,
  VOICE_TYPED,
  voiceErrorCopy,
} from './voiceCopy';

describe('voice copy', () => {
  it('keeps confirm and errors in high-contrast sentences without em dashes', () => {
    expect(formatVoiceConfirm(40, 'Mercor application')).toBe(
      'Starting 40m on Mercor application'
    );
    expect(formatVoiceConfirm(25, '  ')).toBe('Starting 25m on Focus');
    const copy = [
      VOICE_LISTENING,
      VOICE_NOT_SETUP,
      VOICE_MIC_DENIED,
      VOICE_NO_SPEECH,
      VOICE_REPEAT,
      VOICE_TYPED,
      VOICE_NOISY,
      voiceErrorCopy('offline'),
    ].join(' ');
    expect(copy).not.toMatch(/[—–]/);
    expect(parseVoiceQuery('mock')).toBe('mock');
    expect(parseVoiceQuery('1')).toBeNull();
  });
});
