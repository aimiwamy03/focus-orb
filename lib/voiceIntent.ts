export type VoiceStartIntent = {
  kind: 'start';
  minutes: number;
  label: string;
};

export type VoiceIntent =
  | VoiceStartIntent
  | { kind: 'cancel' }
  | { kind: 'yes' }
  | { kind: 'no' }
  | { kind: 'unknown' };

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const MIN_MINUTES = 1;
const MAX_MINUTES = 480;

export function normalizeVoiceTranscript(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.,!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripOrbPrefix(text: string): string {
  return text.replace(/^(hey )?orb[,:]?\s+/, '');
}

function parseNumberToken(token: string): number | null {
  if (/^\d+$/.test(token)) {
    const n = Number(token);
    return Number.isFinite(n) ? n : null;
  }
  return NUMBER_WORDS[token] ?? null;
}

function parseWordNumber(words: string[]): { value: number; consumed: number } | null {
  if (words.length === 0) return null;
  const first = parseNumberToken(words[0]);
  if (first == null) return null;
  if (words.length >= 2) {
    const second = parseNumberToken(words[1]);
    if (second != null && second < 10 && first >= 20 && first % 10 === 0) {
      return { value: first + second, consumed: 2 };
    }
  }
  return { value: first, consumed: 1 };
}

function clampMinutes(minutes: number): number | null {
  const rounded = Math.round(minutes);
  if (!Number.isFinite(rounded) || rounded < MIN_MINUTES || rounded > MAX_MINUTES) {
    return null;
  }
  return rounded;
}

function stripLeadingThe(label: string): string {
  return label.replace(/^(the|a|an)\s+/i, '').trim();
}

function extractLabel(after: string): string {
  const match = after.match(/^(?:on|for)\s+(.+)$/i);
  if (!match) return '';
  return stripLeadingThe(match[1].replace(/\s+/g, ' ').trim());
}

function restoreCasing(raw: string, label: string): string {
  if (!label) return '';
  const lower = raw.toLowerCase();
  const index = lower.lastIndexOf(label.toLowerCase());
  if (index < 0) return label;
  return raw.slice(index, index + label.length).replace(/[.,!?]+$/g, '').trim();
}

type DurationHit = { minutes: number; index: number; end: number };

function findDuration(words: string[]): DurationHit | null {
  const joined = words.join(' ');

  const specials: Array<{ pattern: RegExp; minutes: number }> = [
    { pattern: /\b((an|a|one)\s+)?hour and a half\b/, minutes: 90 },
    { pattern: /\bhour and a half\b/, minutes: 90 },
    { pattern: /\b(a\s+)?half an hour\b/, minutes: 30 },
    { pattern: /\b(a\s+)?half hour\b/, minutes: 30 },
    { pattern: /\ban hour and a half\b/, minutes: 90 },
  ];
  for (const special of specials) {
    const match = joined.match(special.pattern);
    if (match && match.index != null) {
      const before = joined.slice(0, match.index).trim();
      const index = before ? before.split(' ').length : 0;
      const consumed = match[0].trim().split(/\s+/).length;
      return { minutes: special.minutes, index, end: index + consumed };
    }
  }

  for (let i = 0; i < words.length; i += 1) {
    if (words[i] === 'an' && words[i + 1] === 'hour') {
      return { minutes: 60, index: i, end: i + 2 };
    }
    if (words[i] === 'one' && words[i + 1] === 'hour') {
      return { minutes: 60, index: i, end: i + 2 };
    }
    if (words[i] === 'a' && words[i + 1] === 'hour') {
      return { minutes: 60, index: i, end: i + 2 };
    }

    const compactToken = words[i].match(/^(\d+)m$/);
    if (compactToken) {
      const minutes = clampMinutes(Number(compactToken[1]));
      if (minutes) return { minutes, index: i, end: i + 1 };
    }

    const parsed = parseWordNumber(words.slice(i));
    if (!parsed) continue;
    const next = words[i + parsed.consumed];
    if (next === 'hours' || next === 'hour') {
      const minutes = clampMinutes(parsed.value * 60);
      if (minutes) return { minutes, index: i, end: i + parsed.consumed + 1 };
    }
    if (next === 'minutes' || next === 'minute' || next === 'min' || next === 'mins' || next === 'm') {
      const minutes = clampMinutes(parsed.value);
      if (minutes) return { minutes, index: i, end: i + parsed.consumed + 1 };
    }
    if (!next || next === 'on' || next === 'for') {
      const minutes = clampMinutes(parsed.value);
      if (minutes) return { minutes, index: i, end: i + parsed.consumed };
    }
  }

  const compact = joined.match(/\b(\d+)\s*m\b/);
  if (compact && compact.index != null) {
    const minutes = clampMinutes(Number(compact[1]));
    if (minutes) {
      const before = joined.slice(0, compact.index).trim();
      const index = before ? before.split(' ').length : 0;
      return { minutes, index, end: index + compact[0].trim().split(/\s+/).length };
    }
  }

  return null;
}

export function parseVoiceIntent(raw: string): VoiceIntent {
  const normalized = stripOrbPrefix(normalizeVoiceTranscript(raw));
  if (!normalized) return { kind: 'unknown' };

  if (/^(cancel|stop)( it| that| this)?$/.test(normalized)) {
    return { kind: 'cancel' };
  }
  if (/^(yes|yeah|yep|yup|ok|okay|sure|please|do it|do \d+)$/.test(normalized)) {
    return { kind: 'yes' };
  }
  if (/^(no|nope|nah|don't|do not)$/.test(normalized)) {
    return { kind: 'no' };
  }

  const words = normalized.split(' ');
  const duration = findDuration(words);
  if (!duration) return { kind: 'unknown' };

  const afterWords = words.slice(duration.end);
  let label = '';
  if (afterWords[0] === 'on' || afterWords[0] === 'for') {
    label = extractLabel(afterWords.join(' '));
  } else if (afterWords.length) {
    const rest = afterWords.join(' ');
    label = extractLabel(rest) || stripLeadingThe(rest);
  }

  return {
    kind: 'start',
    minutes: duration.minutes,
    label: restoreCasing(raw, label),
  };
}

export const VOICE_LOW_CONFIDENCE = 0.5;
export const VOICE_NOISY_CONFIDENCE = 0.35;

export function isNoisyTranscript(transcript: string, confidence: number | null): boolean {
  const text = normalizeVoiceTranscript(transcript);
  if (/\b(inaudible|unintelligible|background noise|too noisy)\b/.test(text)) return true;
  if (confidence != null && confidence < VOICE_NOISY_CONFIDENCE && text.length > 0) return true;
  return false;
}

export function isLowConfidence(confidence: number | null): boolean {
  return confidence != null && confidence < VOICE_LOW_CONFIDENCE;
}
