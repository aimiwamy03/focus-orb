export interface WhoopEndpoints {
  auth: string;
  token: string;
  revoke: string;
  api: string;
}

export const WHOOP_ENDPOINTS: WhoopEndpoints = {
  auth: 'https://api.prod.whoop.com/oauth/oauth2/auth',
  token: 'https://api.prod.whoop.com/oauth/oauth2/token',
  revoke: 'https://api.prod.whoop.com/oauth/oauth2/revoke',
  api: 'https://api.prod.whoop.com/developer/v2',
};

export function whoopClientId(
  env: NodeJS.Dict<string | undefined> = process.env
): string | undefined {
  return env.WHOOP_CLIENT_ID;
}

export function whoopClientSecret(
  env: NodeJS.Dict<string | undefined> = process.env
): string | undefined {
  return env.WHOOP_CLIENT_SECRET;
}

export function isWhoopConfigured(
  env: NodeJS.Dict<string | undefined> = process.env
): boolean {
  return Boolean(whoopClientId(env) && whoopClientSecret(env));
}
