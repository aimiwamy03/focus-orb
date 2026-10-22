export type MenuFocus = 'input' | 'row';

export interface MenuState {
  focus: MenuFocus;
  index: number;
  count: number;
  hasInput: boolean;
  disabled: boolean[];
}

export interface MenuEvent {
  key: string;
  shiftKey?: boolean;
  inInput?: boolean;
}

export type MenuEffect = 'none' | 'confirm' | 'cancel' | 'focus-input' | 'focus-row';

export interface MenuReduction {
  state: MenuState;
  effect: MenuEffect;
  preventDefault: boolean;
}

/**
 * Game-menu keyboard.
 *
 * Input: Left/Right move the caret. Up, Down, or Tab leaves the input
 * for the button row. Shift+Tab from the first row item returns to the input.
 *
 * Row: Left/Right and Tab move the highlight (wrap, skip disabled).
 * Enter confirms the highlighted item. Escape cancels when the caller
 * treats cancel as the safe default (Keep going / Skip).
 */
export function createMenuState(input: {
  count: number;
  index?: number;
  hasInput?: boolean;
  focus?: MenuFocus;
  disabled?: boolean[];
}): MenuState {
  const count = Math.max(0, input.count);
  const disabled = Array.from({ length: count }, (_, i) => Boolean(input.disabled?.[i]));
  let index = input.index ?? firstEnabled(count, disabled);
  if (count === 0) index = 0;
  else if (index < 0 || index >= count || disabled[index]) {
    index = firstEnabled(count, disabled);
  }
  return {
    focus: input.focus ?? (input.hasInput ? 'input' : 'row'),
    index,
    count,
    hasInput: Boolean(input.hasInput),
    disabled,
  };
}

export function firstEnabled(count: number, disabled: boolean[]): number {
  for (let i = 0; i < count; i++) {
    if (!disabled[i]) return i;
  }
  return 0;
}

export function stepIndex(
  index: number,
  count: number,
  dir: 1 | -1,
  disabled: boolean[] = []
): number {
  if (count <= 0) return 0;
  let next = index;
  for (let i = 0; i < count; i++) {
    next = (next + dir + count) % count;
    if (!disabled[next]) return next;
  }
  return index;
}

function isFirstEnabled(state: MenuState): boolean {
  return state.index === firstEnabled(state.count, state.disabled);
}

export function reduceMenu(state: MenuState, event: MenuEvent): MenuReduction {
  const inInput = event.inInput ?? state.focus === 'input';
  const current: MenuState = { ...state, focus: inInput ? 'input' : 'row' };

  if (current.count <= 0) {
    return { state: current, effect: 'none', preventDefault: false };
  }

  const key = event.key;

  if (inInput) {
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      return { state: current, effect: 'none', preventDefault: false };
    }
    if (key === 'ArrowDown' || key === 'ArrowUp' || (key === 'Tab' && !event.shiftKey)) {
      return {
        state: { ...current, focus: 'row' },
        effect: 'focus-row',
        preventDefault: true,
      };
    }
    return { state: current, effect: 'none', preventDefault: false };
  }

  if (key === 'ArrowLeft' || (key === 'Tab' && event.shiftKey)) {
    if (current.hasInput && key === 'Tab' && event.shiftKey && isFirstEnabled(current)) {
      return {
        state: { ...current, focus: 'input' },
        effect: 'focus-input',
        preventDefault: true,
      };
    }
    return {
      state: {
        ...current,
        index: stepIndex(current.index, current.count, -1, current.disabled),
      },
      effect: 'none',
      preventDefault: true,
    };
  }

  if (key === 'ArrowRight' || key === 'Tab') {
    return {
      state: {
        ...current,
        index: stepIndex(current.index, current.count, 1, current.disabled),
      },
      effect: 'none',
      preventDefault: true,
    };
  }

  if (key === 'ArrowUp' && current.hasInput) {
    return {
      state: { ...current, focus: 'input' },
      effect: 'focus-input',
      preventDefault: true,
    };
  }

  if (key === 'Enter') {
    return { state: current, effect: 'confirm', preventDefault: true };
  }

  if (key === 'Escape') {
    return { state: current, effect: 'cancel', preventDefault: true };
  }

  return { state: current, effect: 'none', preventDefault: false };
}
