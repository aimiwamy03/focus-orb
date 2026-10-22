import { describe, it, expect } from 'vitest';
import {
  interpretAuthSession,
  isFirstOpen,
  isGoogleConfigured,
  shouldUseGoogleFromSession,
} from './onboarding';

describe('isFirstOpen', () => {
  it('shows connect + sample day when nobody is signed in', () => {
    expect(
      isFirstOpen({
        mockScenario: null,
        isGoogleConnected: false,
        calendarUrl: '',
        authMethod: null,
      })
    ).toBe(true);
  });

  it('skips the welcome screen for a WHOOP mock without sign-in', () => {
    expect(
      isFirstOpen({
        mockScenario: null,
        isGoogleConnected: false,
        calendarUrl: '',
        authMethod: null,
        whoopDemo: true,
      })
    ).toBe(false);
  });

  it('hides the mock onboarding after Google sign-in, even before localStorage is set', () => {
    expect(
      isFirstOpen({
        mockScenario: null,
        isGoogleConnected: true,
        calendarUrl: '',
        authMethod: 'google',
      })
    ).toBe(false);
  });
});

describe('interpretAuthSession', () => {
  it('treats a NextAuth session with an access token as Google-connected', () => {
    const view = interpretAuthSession({
      user: { email: 'amy@example.com', name: 'Amy' },
      accessToken: 'ya29.access',
      expires: '2099-01-01T00:00:00.000Z',
    });
    expect(view).toEqual({
      signedIn: true,
      hasGoogleAccess: true,
      email: 'amy@example.com',
    });
    expect(shouldUseGoogleFromSession(view)).toBe(true);
  });

  it('does not treat an empty session payload as signed in', () => {
    expect(interpretAuthSession({})).toEqual({
      signedIn: false,
      hasGoogleAccess: false,
      email: null,
    });
    expect(shouldUseGoogleFromSession(interpretAuthSession(null))).toBe(false);
  });

  it('still uses Google when the user is signed in even if the token field is missing', () => {
    const view = interpretAuthSession({ user: { email: 'amy@example.com' } });
    expect(view.signedIn).toBe(true);
    expect(view.hasGoogleAccess).toBe(false);
    expect(view.email).toBe('amy@example.com');
    expect(shouldUseGoogleFromSession(view)).toBe(true);
  });
});

describe('isGoogleConfigured', () => {
  it('is true only for the public env flag', () => {
    expect(isGoogleConfigured('true')).toBe(true);
    expect(isGoogleConfigured('false')).toBe(false);
    expect(isGoogleConfigured(undefined)).toBe(false);
  });
});
