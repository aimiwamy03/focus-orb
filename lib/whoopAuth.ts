import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { authSecret, authUrl } from './googleAuth';
import { WHOOP_INVITE_ONLY_MESSAGE, WHOOP_REFRESH_SKEW_MS, type WhoopCachedSummary } from './whoop';

export { WHOOP_INVITE_ONLY_MESSAGE };

export const WHOOP_TOKEN_COOKIE = 'whoop_session';
export const WHOOP_STATE_COOKIE = 'whoop_oauth_state';
export const WHOOP_STATE_MIN_LENGTH = 8;
export const WHOOP_CACHE_CONTROL = 'private, no-store';
export const WHOOP_COOKIE_MAX_BYTES = 3800;
export const WHOOP_INVITE_EMAILS_MAX = 10;
const KEY_SALT = 'focus-orb-whoop-v1';
const keyCache = new Map<string, Buffer>();

export interface WhoopCookiePayload {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface WhoopTokenSet extends WhoopCookiePayload {
  summary?: WhoopCachedSummary | null;
}

export function whoopRedirectUri(
  requestUrl: string,
  env: NodeJS.Dict<string | undefined> = process.env
): string {
  const configured = authUrl(env)?.replace(/\/$/, '');
  const origin = configured || new URL(requestUrl).origin;
  return `${origin}/api/whoop/callback`;
}

export function whoopCookieOptions(maxAgeSeconds: number, secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function whoopSetCookieBytes(value: string, secure = true): number {
  const parts = [
    `${WHOOP_TOKEN_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=5184000',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ').length;
}

export function whoopCookiePayload(tokens: WhoopTokenSet): WhoopCookiePayload {
  return {
    userId: tokens.userId,
    email: tokens.email,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  };
}

export function createWhoopState(userId: string, secret: string): string {
  const nonce = randomBytes(16).toString('hex');
  const mac = createHmac('sha256', secret).update(`${nonce}.${userId}`).digest('base64url');
  return `${nonce}.${mac}`;
}

export function stateIsValid(
  expected: string | undefined,
  received: string | null,
  userId?: string | null,
  secret?: string | null
): boolean {
  if (
    !expected ||
    !received ||
    !userId ||
    !secret ||
    expected !== received ||
    expected.length < WHOOP_STATE_MIN_LENGTH
  ) {
    return false;
  }
  const dot = expected.indexOf('.');
  if (dot < WHOOP_STATE_MIN_LENGTH) return false;
  const nonce = expected.slice(0, dot);
  const mac = expected.slice(dot + 1);
  if (!nonce || !mac) return false;
  const expectedMac = createHmac('sha256', secret)
    .update(`${nonce}.${userId}`)
    .digest('base64url');
  const left = Buffer.from(mac);
  const right = Buffer.from(expectedMac);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function deriveKey(secret: string): Buffer {
  const cached = keyCache.get(secret);
  if (cached) return cached;
  const key = scryptSync(secret, KEY_SALT, 32);
  keyCache.set(secret, key);
  return key;
}

export function encryptWhoopPayload(payload: WhoopTokenSet, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(JSON.stringify(whoopCookiePayload(payload)), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptWhoopPayload(
  value: string | undefined | null,
  secret: string
): WhoopTokenSet | null {
  if (!value) return null;
  try {
    const raw = Buffer.from(value, 'base64url');
    if (raw.length < 29) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const parsed = JSON.parse(plain.toString('utf8')) as WhoopTokenSet;
    if (!parsed?.userId || !parsed.email || !parsed.refreshToken || !parsed.accessToken) {
      return null;
    }
    return whoopCookiePayload(parsed);
  } catch {
    return null;
  }
}

export function whoopNeedsRefresh(
  tokens: WhoopTokenSet,
  nowMs: number = Date.now()
): boolean {
  return nowMs >= tokens.expiresAt - WHOOP_REFRESH_SKEW_MS;
}

export function authSecretOrThrow(
  env: NodeJS.Dict<string | undefined> = process.env
): string {
  const secret = authSecret(env);
  if (!secret) throw new Error('Missing AUTH_SECRET');
  return secret;
}

export function isWhoopSecure(
  env: NodeJS.Dict<string | undefined> = process.env
): boolean {
  return env.NODE_ENV === 'production';
}

export function parseWhoopInviteEmails(
  raw: string | null | undefined
): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const email = part.trim().toLowerCase();
    if (!email) continue;
    seen.add(email);
    if (seen.size >= WHOOP_INVITE_EMAILS_MAX) break;
  }
  return [...seen];
}

export function isWhoopEmailInvited(
  email: string | null | undefined,
  env: NodeJS.Dict<string | undefined> = process.env
): boolean {
  if (!email) return false;
  return parseWhoopInviteEmails(env.WHOOP_INVITE_EMAILS).includes(email.trim().toLowerCase());
}

export function sessionWhoopMatches(
  tokens: WhoopTokenSet,
  session: { userId?: string | null; email?: string | null }
): boolean {
  if (!session.userId || !session.email) return false;
  return (
    tokens.userId === session.userId &&
    tokens.email.toLowerCase() === session.email.toLowerCase()
  );
}

export function sessionEmailMatches(
  tokens: WhoopTokenSet,
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return tokens.email.toLowerCase() === email.toLowerCase();
}
