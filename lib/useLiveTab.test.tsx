import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDayModel } from './day';
import { getMockEvents, parseNowParam } from './fixtures';
import { APP_TITLE } from './tab';
import { useLiveTab } from './useLiveTab';

function pinned(hhmm: string): Date {
  return parseNowParam(hhmm, new Date(2026, 9, 9));
}

function modelFor(scenario: Parameters<typeof getMockEvents>[0], hhmm: string) {
  const now = pinned(hhmm);
  return { now, model: buildDayModel(getMockEvents(scenario, now), now) };
}

function Probe(props: {
  model: ReturnType<typeof buildDayModel>;
  scatter: number;
  isManualFocus: boolean;
}) {
  useLiveTab(props);
  return null;
}

function mountTab(
  scenario: Parameters<typeof getMockEvents>[0],
  hhmm: string,
  extra: { scatter?: number; isManualFocus?: boolean } = {}
) {
  const { model } = modelFor(scenario, hhmm);
  document.head.innerHTML = `<title>${APP_TITLE}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml" />`;
  render(
    <Probe
      model={model}
      scatter={extra.scatter ?? 0}
      isManualFocus={extra.isManualFocus ?? false}
    />
  );
  return model;
}

afterEach(() => {
  cleanup();
});

describe('useLiveTab', () => {
  it('keeps document.title Focus Orb in idle, focusing, heads-up, sample-day, meeting, and run', () => {
    const cases: Array<{
      label: string;
      scenario: Parameters<typeof getMockEvents>[0];
      hhmm: string;
      extra?: { scatter?: number; isManualFocus?: boolean };
    }> = [
      { label: 'idle empty', scenario: 'empty', hhmm: '11:00' },
      { label: 'open afternoon', scenario: 'open-afternoon', hhmm: '11:00' },
      { label: 'focusing', scenario: 'empty', hhmm: '11:00', extra: { isManualFocus: true } },
      { label: 'heads-up', scenario: 'pre-meeting', hhmm: '13:25', extra: { scatter: 0.4 } },
      { label: 'sample-day b2b', scenario: 'back-to-back', hhmm: '12:00' },
      { label: 'in meeting', scenario: 'in-meeting', hhmm: '13:45' },
      { label: 'in run', scenario: 'back-to-back', hhmm: '13:45' },
    ];

    for (const row of cases) {
      cleanup();
      mountTab(row.scenario, row.hhmm, row.extra);
      expect(document.title).toBe(APP_TITLE);
    }
  });

  it('still paints a live favicon as status changes', () => {
    cleanup();
    mountTab('empty', '11:00');
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.dataset.orbState).toBe(
      'dense'
    );

    cleanup();
    mountTab('empty', '11:00', { isManualFocus: true });
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.dataset.orbState).toBe(
      'focusing'
    );

    cleanup();
    mountTab('pre-meeting', '13:25', { scatter: 0.4 });
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.dataset.orbState).toBe(
      'scattered'
    );

    cleanup();
    mountTab('in-meeting', '13:45');
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.dataset.orbState).toBe(
      'dim'
    );
  });
});
