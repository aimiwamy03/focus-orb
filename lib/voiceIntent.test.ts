import { describe, expect, it } from 'vitest';
import {
  isLowConfidence,
  isNoisyTranscript,
  parseVoiceIntent,
  VOICE_LOW_CONFIDENCE,
} from './voiceIntent';

describe('parseVoiceIntent', () => {
  it('parses Orb prefix, 40 minutes, and the label after on', () => {
    expect(parseVoiceIntent('Orb, 40 minutes on the Mercor application')).toEqual({
      kind: 'start',
      minutes: 40,
      label: 'Mercor application',
    });
  });

  it('parses 40 min, an hour, half an hour, hour and a half, and bare 25', () => {
    expect(parseVoiceIntent('40 min')).toEqual({ kind: 'start', minutes: 40, label: '' });
    expect(parseVoiceIntent('an hour')).toEqual({ kind: 'start', minutes: 60, label: '' });
    expect(parseVoiceIntent('half an hour')).toEqual({ kind: 'start', minutes: 30, label: '' });
    expect(parseVoiceIntent('hour and a half')).toEqual({ kind: 'start', minutes: 90, label: '' });
    expect(parseVoiceIntent('an hour and a half')).toEqual({ kind: 'start', minutes: 90, label: '' });
    expect(parseVoiceIntent('25')).toEqual({ kind: 'start', minutes: 25, label: '' });
  });

  it('takes the label after for', () => {
    expect(parseVoiceIntent('25 minutes for writing')).toEqual({
      kind: 'start',
      minutes: 25,
      label: 'writing',
    });
  });

  it('parses cancel and stop', () => {
    expect(parseVoiceIntent('cancel')).toEqual({ kind: 'cancel' });
    expect(parseVoiceIntent('Stop')).toEqual({ kind: 'cancel' });
    expect(parseVoiceIntent('Orb, stop')).toEqual({ kind: 'cancel' });
  });

  it('parses yes and no for the conflict prompt', () => {
    expect(parseVoiceIntent('yes')).toEqual({ kind: 'yes' });
    expect(parseVoiceIntent('yeah')).toEqual({ kind: 'yes' });
    expect(parseVoiceIntent('do 30')).toEqual({ kind: 'yes' });
    expect(parseVoiceIntent('no')).toEqual({ kind: 'no' });
    expect(parseVoiceIntent('nope')).toEqual({ kind: 'no' });
  });

  it('parses number words and compact durations', () => {
    expect(parseVoiceIntent('forty minutes on docs')).toEqual({
      kind: 'start',
      minutes: 40,
      label: 'docs',
    });
    expect(parseVoiceIntent('two hours')).toEqual({ kind: 'start', minutes: 120, label: '' });
    expect(parseVoiceIntent('20m on review')).toEqual({
      kind: 'start',
      minutes: 20,
      label: 'review',
    });
  });

  it('returns unknown when there is no duration or command', () => {
    expect(parseVoiceIntent('')).toEqual({ kind: 'unknown' });
    expect(parseVoiceIntent('start focusing please')).toEqual({ kind: 'unknown' });
  });
});

describe('confidence helpers', () => {
  it('treats low scores and noisy transcripts as fallbacks', () => {
    expect(isLowConfidence(VOICE_LOW_CONFIDENCE - 0.01)).toBe(true);
    expect(isLowConfidence(0.9)).toBe(false);
    expect(isLowConfidence(null)).toBe(false);
    expect(isNoisyTranscript('inaudible', 0.9)).toBe(true);
    expect(isNoisyTranscript('hello there', 0.2)).toBe(true);
    expect(isNoisyTranscript('forty minutes', 0.8)).toBe(false);
  });
});
