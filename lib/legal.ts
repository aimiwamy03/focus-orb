export const CONTACT_EMAIL = 'hello@example.com';

export const ABOUT_LABEL = 'About';
export const PRIVACY_LABEL = 'Privacy';
export const HEALTH_DATA_LABEL = 'Health data';
export const HOME_LABEL = 'Focus Orb';

export const ABOUT_HEADING = 'About';
export const ABOUT_BODY =
  'Focus Orb is a quiet focus timer. It can watch the calendars you pick so it can make room for meetings. Connecting WHOOP is optional and invite-only during beta.';

export const PRIVACY_HEADING = 'Privacy';
export const PRIVACY_INTRO =
  'Focus Orb is a focus timer. Signing in with Google is only used to identify you and, if you turn calendar on, to read the calendars you pick so the orb can make room for meetings.';

export const PRIVACY_WHOOP_HEADING = 'WHOOP';
export const PRIVACY_WHOOP_BODY = [
  'Connecting WHOOP is optional and invite-only during beta.',
  'If you connect it, Focus Orb asks WHOOP for recovery, sleep, and cycles so it can suggest a focus length.',
  'The whoop_session cookie holds only encrypted tokens, expiry, your Google id, and email. It never holds WHOOP scores.',
  'Focus Orb does not write WHOOP data to a database. Numbers shown in the app stay in this browser until you disconnect or sign out.',
  'Disconnect in Settings revokes access at WHOOP and deletes the cookie. Sign out only deletes the cookie on this browser.',
  'If revoke fails, remove Focus Orb in the WHOOP app.',
].join(' ');

export const PRIVACY_CONTACT_HEADING = 'Contact';
export const PRIVACY_CONTACT_BODY = `Questions about privacy: ${CONTACT_EMAIL}. This is a placeholder address until a real inbox is set.`;

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
