'use server';

import { signIn, signOut } from '@/lib/auth';
import { cookies } from 'next/headers';
import { GOOGLE_CALENDAR_AUTH, GOOGLE_IDENTITY_AUTH } from '@/lib/googleAuth';
import { WHOOP_TOKEN_COOKIE } from '@/lib/whoopAuth';

export async function signInWithGoogle() {
  await signIn('google', { redirectTo: '/' }, { ...GOOGLE_IDENTITY_AUTH });
}

export async function signInWithGoogleCalendar() {
  await signIn('google', { redirectTo: '/' }, { ...GOOGLE_CALENDAR_AUTH });
}

export async function signOutAction() {
  const jar = await cookies();
  jar.delete(WHOOP_TOKEN_COOKIE);
  await signOut({ redirectTo: '/' });
}
