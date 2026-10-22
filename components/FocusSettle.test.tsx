import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import { FocusSettle } from './FocusSettle';
import { SETTLE_SKIP_HINT } from '@/lib/orbGrowth';

afterEach(() => cleanup());

describe('FocusSettle', () => {
  it('skips on Escape, Enter, Space, or a press', () => {
    const onSkip = vi.fn();
    render(<FocusSettle onSkip={onSkip} />);
    expect(screen.getByTestId('settle-hint').textContent).toBe(SETTLE_SKIP_HINT);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.pointerDown(screen.getByTestId('focus-settle'));
    expect(onSkip).toHaveBeenCalledTimes(4);
    expect(onSkip.mock.calls.every((call) => call[0] === true)).toBe(true);
  });
});
