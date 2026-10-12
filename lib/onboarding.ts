export type AuthMethod = 'google' | 'ical' | null;

export interface FirstOpenState {
  mockScenario: string | null;
  isGoogleConnected: boolean;
  calendarUrl: string;
  authMethod: AuthMethod;
}

export function isFirstOpen({
  mockScenario,
  isGoogleConnected,
  calendarUrl,
  authMethod,
}: FirstOpenState): boolean {
  return (
    !mockScenario &&
    !isGoogleConnected &&
    !calendarUrl &&
    authMethod !== 'google' &&
    authMethod !== 'ical'
  );
}

export interface AuthSessionView {
  signedIn: boolean;
  hasGoogleAccess: boolean;
}

export function interpretAuthSession(payload: unknown): AuthSessionView {
  if (!payload || typeof payload !== 'object') {
    return { signedIn: false, hasGoogleAccess: false };
  }

  const session = payload as {
    user?: { email?: string | null; name?: string | null } | null;
    accessToken?: unknown;
  };

  const signedIn = Boolean(session.user && (session.user.email || session.user.name));
  const hasGoogleAccess =
    typeof session.accessToken === 'string' && session.accessToken.length > 0;

  return { signedIn, hasGoogleAccess };
}

export function shouldUseGoogleFromSession(view: AuthSessionView): boolean {
  return view.hasGoogleAccess || view.signedIn;
}
