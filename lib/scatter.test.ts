import { describe, it, expect } from 'vitest';
import { calculateScatter, calculateManualScatter, formatTimeRemaining, formatTabTitle } from './scatter';

describe('calculateScatter', () => {
  it('returns 0 when far from event (>= scatter window)', () => {
    expect(calculateScatter(60, 60)).toBe(0);
    expect(calculateScatter(90, 60)).toBe(0);
    expect(calculateScatter(120, 60)).toBe(0);
  });

  it('returns 1 when event has started (minutes <= 0)', () => {
    expect(calculateScatter(0, 60)).toBe(1);
    expect(calculateScatter(-5, 60)).toBe(1);
    expect(calculateScatter(-30, 60)).toBe(1);
  });

  it('ramps from 0 to 1 within scatter window', () => {
    const scatter30 = calculateScatter(30, 60); // halfway
    const scatter15 = calculateScatter(15, 60); // 3/4 through
    const scatter45 = calculateScatter(45, 60); // 1/4 through
    
    // Should increase as we get closer to event
    expect(scatter45).toBeGreaterThan(0);
    expect(scatter45).toBeLessThan(scatter30);
    expect(scatter30).toBeLessThan(scatter15);
    expect(scatter15).toBeLessThan(1);
  });

  it('uses ease-in curve (accelerating)', () => {
    const scatter50 = calculateScatter(30, 60); // 50% progress
    // Ease-in means slower at start, so at 50% progress, scatter should be < 0.5
    expect(scatter50).toBeLessThan(0.5);
  });

  it('handles different scatter windows', () => {
    // 15 min window
    expect(calculateScatter(15, 15)).toBe(0);
    expect(calculateScatter(0, 15)).toBe(1);
    
    // 90 min window
    expect(calculateScatter(90, 90)).toBe(0);
    expect(calculateScatter(45, 90)).toBeGreaterThan(0);
    expect(calculateScatter(45, 90)).toBeLessThan(1);
  });
});

describe('calculateManualScatter', () => {
  it('returns 0 early in focus block', () => {
    // 25 min block, 24 min remaining: ramp window is min(25*0.4, 60) = 10 min
    // 24 > 10, so scatter should be 0
    expect(calculateManualScatter(24, 25)).toBe(0);
    expect(calculateManualScatter(20, 25)).toBe(0);
    expect(calculateManualScatter(11, 25)).toBe(0);
  });

  it('returns 1 when block is complete', () => {
    expect(calculateManualScatter(0, 25)).toBe(1);
    expect(calculateManualScatter(-1, 25)).toBe(1);
  });

  it('ramps over last 40% of block', () => {
    // 25 min block: ramp window = 25 * 0.4 = 10 min
    // So scatter starts at 10 min remaining
    expect(calculateManualScatter(10, 25)).toBe(0);
    
    const scatter5 = calculateManualScatter(5, 25); // halfway through ramp
    const scatter2 = calculateManualScatter(2, 25); // 80% through ramp
    
    expect(scatter5).toBeGreaterThan(0);
    expect(scatter5).toBeLessThan(scatter2);
    expect(scatter2).toBeLessThan(1);
  });

  it('caps ramp window at maxWindow', () => {
    // 90 min block: ramp window = min(90 * 0.4, 60) = min(36, 60) = 36 min
    expect(calculateManualScatter(37, 90)).toBe(0);
    expect(calculateManualScatter(36, 90)).toBe(0);
    expect(calculateManualScatter(18, 90)).toBeGreaterThan(0); // halfway through 36-min ramp
  });

  it('handles short blocks correctly', () => {
    // 10 min block: ramp window = 10 * 0.4 = 4 min
    expect(calculateManualScatter(5, 10)).toBe(0);
    expect(calculateManualScatter(4, 10)).toBe(0);
    expect(calculateManualScatter(2, 10)).toBeGreaterThan(0);
  });

  it('never uses ramp window longer than block duration', () => {
    // 5 min block: ramp window = min(5 * 0.4, 60) = 2 min
    // Not 60 min, which would be longer than the block
    expect(calculateManualScatter(5, 5)).toBe(0);
    expect(calculateManualScatter(3, 5)).toBe(0);
    expect(calculateManualScatter(2, 5)).toBe(0);
    expect(calculateManualScatter(1, 5)).toBeGreaterThan(0);
  });
});

describe('formatTimeRemaining', () => {
  it('formats negative time as "now"', () => {
    expect(formatTimeRemaining(-1)).toBe('now');
    expect(formatTimeRemaining(-30)).toBe('now');
  });

  it('formats < 1 minute', () => {
    expect(formatTimeRemaining(0.5)).toBe('< 1m');
  });

  it('formats minutes only', () => {
    expect(formatTimeRemaining(5)).toBe('5m');
    expect(formatTimeRemaining(30)).toBe('30m');
    expect(formatTimeRemaining(59)).toBe('59m');
  });

  it('formats hours and minutes', () => {
    expect(formatTimeRemaining(90)).toBe('1h 30m');
    expect(formatTimeRemaining(125)).toBe('2h 5m');
  });

  it('formats hours only when no remaining minutes', () => {
    expect(formatTimeRemaining(60)).toBe('1h');
    expect(formatTimeRemaining(120)).toBe('2h');
  });
});

describe('formatTabTitle', () => {
  it('formats with bullet prefix', () => {
    expect(formatTabTitle(5)).toBe('● 5m');
    expect(formatTabTitle(90)).toBe('● 1h30m');
  });

  it('formats negative as now', () => {
    expect(formatTabTitle(-1)).toBe('● now');
  });

  it('formats < 1 minute', () => {
    expect(formatTabTitle(0.5)).toBe('● <1m');
  });
});
