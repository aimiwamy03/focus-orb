import { describe, expect, it } from 'vitest';
import { detectWhoopStates, suggestWhoop } from './whoop';
import { mockWhoopFacts, mockWhoopSummary, parseWhoopQuery } from './whoop.mock';

describe('WHOOP mock query', () => {
  it('parses every mock key and ignores junk', () => {
    expect(parseWhoopQuery('red')).toBe('red');
    expect(parseWhoopQuery('calibrating')).toBe('calibrating');
    expect(parseWhoopQuery('nope')).toBeNull();
    expect(parseWhoopQuery(null)).toBeNull();
  });

  it('builds facts that trigger the named state', () => {
    expect(detectWhoopStates(mockWhoopFacts('green')!)).toContain('green');
    expect(detectWhoopStates(mockWhoopFacts('yellow')!)).toContain('yellow');
    expect(detectWhoopStates(mockWhoopFacts('red')!)).toContain('red');
    expect(detectWhoopStates(mockWhoopFacts('sleep')!)).toContain('sleep');
    expect(detectWhoopStates(mockWhoopFacts('debt')!)).toContain('debt');
    expect(detectWhoopStates(mockWhoopFacts('strain')!)).toContain('strain');
    expect(detectWhoopStates(mockWhoopFacts('workout', Date.now())!)).toContain('workout');
    expect(detectWhoopStates(mockWhoopFacts('late', Date.now())!)).toContain('late');
    expect(detectWhoopStates(mockWhoopFacts('pending')!)).toEqual(['pending']);
    expect(detectWhoopStates(mockWhoopFacts('calibrating')!)).toEqual(['pending']);
    expect(mockWhoopFacts('disconnected')).toBeNull();
    expect(mockWhoopFacts('nodata')).toBeNull();
  });

  it('keeps disconnected as a settings-only mock', () => {
    const summary = mockWhoopSummary('disconnected');
    expect(summary.connected).toBe(false);
    expect(summary.status).toBe('disconnected');
    expect(summary.facts).toBeNull();
  });

  it('still suggests a first block on a named mock', () => {
    expect(suggestWhoop(mockWhoopFacts('red')!, true).rhythm.firstBlockMinutes).toBe(25);
    expect(suggestWhoop(mockWhoopFacts('red')!, true).line).toBe(
      'Recovery 28%, slept 5h 50m (72%), so 25m blocks today.'
    );
    expect(suggestWhoop(mockWhoopFacts('red')!, false).line).toBe(
      'Recovery is low, sleep was short, so shorter blocks today.'
    );
  });

  it('keeps no-data connected without inventing facts', () => {
    const summary = mockWhoopSummary('nodata');
    expect(summary.connected).toBe(true);
    expect(summary.status).toBe('no-data');
    expect(summary.facts).toBeNull();
    expect(summary.email).toBeNull();
  });
});
