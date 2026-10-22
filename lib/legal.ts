export const CONTACT_EMAIL = 'hello@example.com';
export const GOOGLE_PERMISSIONS_URL = 'https://myaccount.google.com/permissions';
export const GOOGLE_LIMITED_USE_URL =
  'https://developers.google.com/terms/api-services-user-data-policy';

export const ABOUT_HEADING = 'Focus Orb';
export const ABOUT_LEDE =
  'A quiet focus timer. The orb gathers as you work, and it can watch the calendars you pick so it can make room for meetings.';

export const ABOUT_WHAT_HEADING = 'What Focus Orb does';
export const ABOUT_WHAT_BODY = [
  'You set one thing to focus on, and the orb stays with you while you work.',
  'Signing in with Google identifies you. Calendar access is added later, only if you turn it on, so Focus Orb can show free time, warn you before a meeting, and stay quiet while you are in one.',
  'Connecting WHOOP is optional and invite-only during beta.',
  'You can also try a sample day without signing in.',
].join(' ');

export const ABOUT_CALENDAR_HEADING = 'How we use Google Calendar';
export const ABOUT_CALENDAR_BODY = [
  'Connecting Google Calendar is optional.',
  'When you connect, Focus Orb only reads your calendar data.',
  'It never creates, edits, or deletes events.',
].join(' ');

export const ABOUT_BODY = [
  'Focus Orb is a quiet focus timer.',
  'It can watch the calendars you pick so it can make room for meetings.',
  'Connecting WHOOP is optional and invite-only during beta.',
].join(' ');

export const PRIVACY_HEADING = 'Privacy';
export const TERMS_HEADING = 'Terms';
export const ABOUT_LABEL = 'About';
export const PRIVACY_LABEL = 'Privacy';
export const TERMS_LABEL = 'Terms';
export const HEALTH_DATA_LABEL = 'Health data';
export const HOME_LABEL = 'Focus Orb';
export const OPEN_APP_LABEL = 'Open the timer';

export const PRIVACY_INTRO =
  'Focus Orb is a focus timer. Signing in with Google is only used to identify you and, if you turn calendar on, to read the calendars you pick so the orb can make room for meetings.';

export const PRIVACY_DATA_HEADING = 'What Calendar data we read';
export const PRIVACY_DATA_BODY = [
  'Focus Orb requests read-only calendar access only after you turn calendar on.',
  'It reads your calendar list (name, id, color, and whether a calendar is primary) so you can pick which ones to watch.',
  'It reads events on those calendars: title, start and end time, all-day flag, status, busy or free, location, and meeting links such as Google Meet.',
  'It does not read your email body, Drive files, or contacts.',
].join(' ');

export const PRIVACY_USE_HEADING = 'How that data is used';
export const PRIVACY_USE_BODY = [
  'Calendar data is used only to show free gaps, upcoming meetings, and to dim the orb during a meeting.',
  'It is not used for ads, ranking, or training models.',
].join(' ');

export const PRIVACY_SHARE_HEADING = 'We do not sell or share it';
export const PRIVACY_SHARE_BODY = [
  'Focus Orb does not sell your Calendar data.',
  'It does not share that data with other companies, advertisers, or data brokers.',
  'Google receives the OAuth request when you connect, and you can revoke access at any time.',
].join(' ');

export const PRIVACY_STORE_HEADING = 'Storage and retention';
export const PRIVACY_STORE_BODY = [
  'Event lists are fetched when you open the app and kept in memory for that visit.',
  'Focus Orb does not write your Calendar events to its own database.',
  'A sign-in cookie keeps your session so you do not have to connect every time.',
  'Sign out clears that session and the WHOOP cookie on this browser.',
  'Your focus log stays in this browser unless you clear it.',
].join(' ');

export const PRIVACY_REVOKE_HEADING = 'How to revoke access';
export const PRIVACY_REVOKE_BODY = [
  `Sign out in Focus Orb Settings, then remove Focus Orb from your Google Account permissions at ${GOOGLE_PERMISSIONS_URL}.`,
  'After you revoke access, Focus Orb cannot read your calendars until you connect again.',
].join(' ');

export const PRIVACY_CONTACT_HEADING = 'Contact';
export const PRIVACY_CONTACT_BODY = `Questions about privacy: ${CONTACT_EMAIL}. This is a placeholder address until a real inbox is set.`;

export const PRIVACY_LIMITED_USE =
  "Focus Orb's use and transfer of information received from Google APIs to any other app will adhere to the Google API Services User Data Policy, including the Limited Use requirements.";

export const PRIVACY_WHOOP_HEADING = 'WHOOP';
export const PRIVACY_WHOOP_BODY = [
  'Connecting WHOOP is optional and invite-only during beta.',
  'If you connect it, Focus Orb asks WHOOP for recovery, sleep, and cycles so it can suggest a focus length.',
  'The whoop_session cookie holds only encrypted tokens, expiry, your Google id, and email. It never holds WHOOP scores.',
  'Focus Orb does not write WHOOP data to a database. Numbers shown in the app stay in this browser until you disconnect or sign out.',
  'Disconnect in Settings revokes access at WHOOP and deletes the cookie. Sign out only deletes the cookie on this browser.',
  'If revoke fails, remove Focus Orb in the WHOOP app.',
].join(' ');

export const HEALTH_DATA_HEADING = 'Consumer health data';
export const HEALTH_DATA_INTRO =
  'This page is the consumer health data policy for Focus Orb. It covers WHOOP recovery, sleep, and cycle data if you choose to connect WHOOP.';

export const HEALTH_DATA_READ_HEADING = 'What we read';
export const HEALTH_DATA_READ_BODY =
  'Recovery, sleep, and daily cycles. Focus Orb uses those numbers to suggest a focus length. You can ignore the suggestion and start a different length.';

export const HEALTH_DATA_STORE_HEADING = 'Where it stays';
export const HEALTH_DATA_STORE_BODY =
  'WHOOP tokens stay in an encrypted cookie on this browser. The cookie does not store recovery, sleep, or cycle numbers. Focus Orb does not keep a database of your health data.';

export const HEALTH_DATA_INVITE_HEADING = 'Who can connect';
export const HEALTH_DATA_INVITE_BODY =
  'WHOOP is invite-only during beta. Only emails listed by the operator can connect.';

export const HEALTH_DATA_STOP_HEADING = 'How to stop';
export const HEALTH_DATA_STOP_BODY =
  'Disconnect in Settings. That asks WHOOP to revoke access and deletes the cookie. Sign out also deletes the cookie on this browser. If revoke fails, remove Focus Orb in the WHOOP app.';

export const HEALTH_DATA_CONTACT_BODY = `Questions: ${CONTACT_EMAIL}. This is a placeholder address until a real inbox is set.`;

export const TERMS_INTRO =
  'These terms are a simple agreement for using Focus Orb. If you do not agree, do not use the app.';

export const TERMS_BODY = [
  'Focus Orb is a focus timer. You choose what to work on. The app may read Google Calendar data you grant, only as described in Privacy.',
  'Google Calendar and WHOOP stay theirs. Focus Orb is not those products, and it does not promise their uptime.',
  'The app is provided as is, without warranties. Your focus log lives in your browser. You can clear it in Settings.',
  'We may change the app, these terms, or the privacy policy. The current pages are the ones that apply.',
  `Questions: ${CONTACT_EMAIL}. This is a placeholder address until a real inbox is set.`,
].join(' ');

const APP_SHELL_KEYS = [
  'mock',
  'whoop',
  'orb',
  'intro',
  'focus',
  'prompt',
  'demo',
  'mini',
  'minionly',
  'settings',
  'scatter',
] as const;

export function showsAppShell(
  params: Record<string, string | string[] | undefined> | URLSearchParams
): boolean {
  const get = (key: string) => {
    if (params instanceof URLSearchParams) return params.get(key);
    const value = params[key];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };
  return APP_SHELL_KEYS.some((key) => {
    const value = get(key);
    return value != null && value !== '';
  });
}

export const LEGAL_COPY = [
  ABOUT_LEDE,
  ABOUT_WHAT_BODY,
  ABOUT_CALENDAR_BODY,
  ABOUT_BODY,
  PRIVACY_INTRO,
  PRIVACY_DATA_BODY,
  PRIVACY_USE_BODY,
  PRIVACY_SHARE_BODY,
  PRIVACY_STORE_BODY,
  PRIVACY_REVOKE_BODY,
  PRIVACY_CONTACT_BODY,
  PRIVACY_LIMITED_USE,
  PRIVACY_WHOOP_BODY,
  HEALTH_DATA_INTRO,
  HEALTH_DATA_READ_BODY,
  HEALTH_DATA_STORE_BODY,
  HEALTH_DATA_INVITE_BODY,
  HEALTH_DATA_STOP_BODY,
  HEALTH_DATA_CONTACT_BODY,
  TERMS_INTRO,
  TERMS_BODY,
];
