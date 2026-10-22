import { describe, expect, it } from 'vitest';
import { createMenuState, reduceMenu, stepIndex } from './menuKey';

function confirmMenu() {
  return createMenuState({ count: 2, index: 0, hasInput: false });
}

function askMenu(index = 1) {
  return createMenuState({ count: 3, index, hasInput: true, focus: 'input' });
}

describe('stepIndex', () => {
  it('wraps and skips disabled items', () => {
    expect(stepIndex(0, 3, 1)).toBe(1);
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
    expect(stepIndex(0, 4, 1, [false, true, false, false])).toBe(2);
    expect(stepIndex(2, 4, -1, [false, true, false, false])).toBe(0);
  });
});

describe('reduceMenu confirm row', () => {
  it('starts on Keep going and Right highlights End', () => {
    const start = confirmMenu();
    expect(start.index).toBe(0);
    const right = reduceMenu(start, { key: 'ArrowRight' });
    expect(right.state.index).toBe(1);
    expect(right.preventDefault).toBe(true);
    const left = reduceMenu(right.state, { key: 'ArrowLeft' });
    expect(left.state.index).toBe(0);
  });

  it('Tab and Shift+Tab move the highlight', () => {
    const tab = reduceMenu(confirmMenu(), { key: 'Tab' });
    expect(tab.state.index).toBe(1);
    const shift = reduceMenu(tab.state, { key: 'Tab', shiftKey: true });
    expect(shift.state.index).toBe(0);
  });

  it('Enter confirms the highlighted item and Esc cancels', () => {
    const end = reduceMenu(confirmMenu(), { key: 'ArrowRight' });
    const enter = reduceMenu(end.state, { key: 'Enter' });
    expect(enter.effect).toBe('confirm');
    expect(enter.state.index).toBe(1);
    const esc = reduceMenu(confirmMenu(), { key: 'Escape' });
    expect(esc.effect).toBe('cancel');
  });
});

describe('reduceMenu ask input vs chips', () => {
  it('leaves Left/Right to the caret while the input has text', () => {
    const start = askMenu();
    const left = reduceMenu(start, { key: 'ArrowLeft', inInput: true, inputEmpty: false });
    expect(left.state.index).toBe(1);
    expect(left.state.focus).toBe('input');
    expect(left.preventDefault).toBe(false);
    expect(left.effect).toBe('none');
    const right = reduceMenu(start, { key: 'ArrowRight', inInput: true, inputEmpty: false });
    expect(right.state.index).toBe(1);
    expect(right.preventDefault).toBe(false);
  });

  it('moves chips with Left/Right when the input is empty', () => {
    const start = askMenu();
    const right = reduceMenu(start, { key: 'ArrowRight', inInput: true, inputEmpty: true });
    expect(right.state.focus).toBe('row');
    expect(right.state.index).toBe(2);
    expect(right.preventDefault).toBe(true);
    expect(right.effect).toBe('focus-row');
    const left = reduceMenu(start, { key: 'ArrowLeft', inInput: true, inputEmpty: true });
    expect(left.state.index).toBe(0);
    expect(left.preventDefault).toBe(true);
  });

  it('moves to the chip row on Down, Up, or Tab', () => {
    const start = askMenu();
    const down = reduceMenu(start, { key: 'ArrowDown', inInput: true });
    expect(down.state.focus).toBe('row');
    expect(down.effect).toBe('focus-row');
    expect(down.preventDefault).toBe(true);
    expect(down.state.index).toBe(2);

    const tab = reduceMenu(start, { key: 'Tab', inInput: true });
    expect(tab.state.focus).toBe('row');
    expect(tab.effect).toBe('focus-row');

    const up = reduceMenu(start, { key: 'ArrowUp', inInput: true });
    expect(up.state.focus).toBe('row');
    expect(up.state.index).toBe(0);
    expect(up.preventDefault).toBe(true);
  });

  it('moves chips with arrows once focus has left the input', () => {
    const row = { ...askMenu(), focus: 'row' as const };
    const right = reduceMenu(row, { key: 'ArrowRight', inInput: false });
    expect(right.state.index).toBe(2);
    expect(right.preventDefault).toBe(true);
    const wrap = reduceMenu(right.state, { key: 'ArrowRight', inInput: false });
    expect(wrap.state.index).toBe(0);
    const enter = reduceMenu(right.state, { key: 'Enter', inInput: false });
    expect(enter.effect).toBe('confirm');
  });

  it('returns to the input with Up or Shift+Tab from the first chip', () => {
    const first = createMenuState({
      count: 3,
      index: 0,
      hasInput: true,
      focus: 'row',
    });
    const up = reduceMenu(first, { key: 'ArrowUp', inInput: false });
    expect(up.state.focus).toBe('input');
    expect(up.effect).toBe('focus-input');
    const shift = reduceMenu(first, { key: 'Tab', shiftKey: true, inInput: false });
    expect(shift.state.focus).toBe('input');
    expect(shift.effect).toBe('focus-input');
  });

  it('confirms Enter while the caret is in the input so Start can fire immediately', () => {
    const enter = reduceMenu(askMenu(), { key: 'Enter', inInput: true });
    expect(enter.effect).toBe('confirm');
    expect(enter.preventDefault).toBe(true);
  });
});

describe('reduceMenu completed and disabled chips', () => {
  it('can default to the last item (Another round)', () => {
    const start = createMenuState({ count: 2, index: 1, hasInput: false });
    expect(start.index).toBe(1);
    const left = reduceMenu(start, { key: 'ArrowLeft' });
    expect(left.state.index).toBe(0);
  });

  it('skips a disabled duration chip', () => {
    const start = createMenuState({
      count: 4,
      index: 1,
      hasInput: true,
      focus: 'row',
      disabled: [false, false, true, false],
    });
    const right = reduceMenu(start, { key: 'ArrowRight', inInput: false });
    expect(right.state.index).toBe(3);
  });
});
