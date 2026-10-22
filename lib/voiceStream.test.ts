import { describe, expect, it } from 'vitest';
import { parseVoiceTurnForTests } from './voiceStream';

describe('parseVoiceTurnForTests', () => {
  it('reads AssemblyAI Turn frames and ignores other messages', () => {
    expect(
      parseVoiceTurnForTests({
        type: 'Turn',
        transcript: 'forty minutes on docs',
        end_of_turn: true,
        end_of_turn_confidence: 0.91,
      })
    ).toEqual({
      transcript: 'forty minutes on docs',
      confidence: 0.91,
      final: true,
    });
    expect(parseVoiceTurnForTests({ type: 'Begin', id: '1' })).toBeNull();
  });
});
