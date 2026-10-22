import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { authSecret, authUrl } from './googleAuth';
import { WHOOP_REFRESH_SKEW_MS, type WhoopCachedSummary } from './whoop';

export const WHOOP_TOKEN_COOKIE = 'whoop_session';
export const WHOOP_STATE_COOKIE = 'whoop_oauth_state';
export const WHOOP_STATE_MIN_LENGTH = 8;

const KEY_SALT = 'focus-orb-whoop-v1';
const keyCache = new Map<string, Buffer>();

export interface WhoopTokenSet {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
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

export function createWhoopState(): string {
  return randomBytes(16).toString('hex');
}

export function stateIsValid(expected: string | undefined, received: string | null): boolean {
  return Boolean(
    expected &&
      received &&
      expected.length >= WHOOP_STATE_MIN_LENGTH &&
      expected === received
  );
}

function deriveKey(secret: string): Buffer {
  const cached = keyCache.get(secret);
  if (cached) return cached;
  const key = scryptSync(secret, KEY_SALT, 32);
  keyCache.set(secret, key);
  return key;
}

export function encryptWhoopPayload(
  payload: WhoopTokenSet,
  secret: string
): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(JSON.stringify(payload), 'utf8');
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
    if (!parsed?.email || !parsed.refreshToken) return null;
    return parsed;
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

export function sessionEmailMatches(
  tokens: WhoopTokenSet,
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return tokens.email.toLowerCase() === email.toLowerCase();
}
