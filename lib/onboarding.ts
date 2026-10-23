export type AuthMethod = 'google' | 'ical' | null;

export interface FirstOpenState {
  mockScenario: string | null;
  isGoogleConnected: boolean;
  calendarUrl: string;
  authMethod: AuthMethod;
  whoopDemo?: boolean;
}

export function isFirstOpen({
  mockScenario,
  isGoogleConnected,
  calendarUrl,
  authMethod,
  whoopDemo = false,
}: FirstOpenState): boolean {
  return (
    !mockScenario &&
    !whoopDemo &&
    !isGoogleConnected &&
    !calendarUrl &&
    authMethod !== 'google' &&
    authMethod !== 'ical'
  );
}

export interface AuthSessionView {
  signedIn: boolean;
  hasGoogleAccess: boolean;
  hasCalendar: boolean;
  email: string | null;
  userId: string | null;
}

export function isGoogleConfigured(
  value: string | undefined = process.env.NEXT_PUBLIC_GOOGLE_CONFIGURED
): boolean {
  return value === 'true';
}

export const WELCOME_LINE = 'A quiet timer that watches your calendar.';
export const CONNECT_LABEL = 'Connect your calendar';
export const SAMPLE_DAY_LINK = 'Try a sample day';

export function interpretAuthSession(payload: unknown): AuthSessionView {
  if (!payload || typeof payload !== 'object') {
    return {
      signedIn: false,
      hasGoogleAccess: false,
      hasCalendar: false,
      email: null,
      userId: null,
    };
  }

  const session = payload as {
    user?: { email?: string | null; name?: string | null; id?: string | null } | null;
    accessToken?: unknown;
    hasCalendar?: unknown;
  };

  const email =
    typeof session.user?.email === 'string' && session.user.email.trim()
      ? session.user.email
      : null;
  const userId =
    typeof session.user?.id === 'string' && session.user.id.trim() ? session.user.id : null;
  const signedIn = Boolean(session.user && (email || session.user.name));
  const hasGoogleAccess =
    typeof session.accessToken === 'string' && session.accessToken.length > 0;
  const hasCalendar =
    session.hasCalendar === true || (session.hasCalendar !== false && hasGoogleAccess);

  return { signedIn, hasGoogleAccess, hasCalendar, email, userId };
}

export function shouldUseGoogleFromSession(view: AuthSessionView): boolean {
  return view.hasGoogleAccess || view.signedIn;
}
