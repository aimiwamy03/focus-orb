import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ShortcutsCard } from './ShortcutsCard';
import { GOT_IT_LABEL } from '@/lib/shortcuts';

afterEach(() => cleanup());

describe('ShortcutsCard', () => {
  it('sits in the top right like live chrome help and dismisses with Got it', () => {
    const onDismiss = vi.fn();
    render(<ShortcutsCard onDismiss={onDismiss} />);
    const card = screen.getByTestId('shortcuts-card');
    expect(card.className).toMatch(/fixed/);
    expect(card.className).toMatch(/top-4/);
    expect(card.className).toMatch(/right-4/);
    expect(card.className).not.toMatch(/left-4/);
    expect(card.className).not.toMatch(/text-center/);
    screen.getByTestId('shortcuts-got-it').click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('shortcuts-got-it').textContent).toBe(GOT_IT_LABEL);
    expect(card.textContent).not.toMatch(/Voice/i);
  });
});
