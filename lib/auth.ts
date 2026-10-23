import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import {
  applyGoogleAccountToToken,
  attachGoogleAccessToSession,
  GOOGLE_IDENTITY_AUTH,
  googleClientId,
  googleClientSecret,
  googleJwtNeedsRefresh,
  isGoogleAuthConfigured,
  refreshGoogleAccessToken,
  type GoogleToken,
} from "@/lib/googleAuth";

const googleId = googleClientId();
const googleSecret = googleClientSecret();

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: isGoogleAuthConfigured() && googleId && googleSecret
    ? [
        Google({
          clientId: googleId,
          clientSecret: googleSecret,
          authorization: {
            params: { ...GOOGLE_IDENTITY_AUTH },
          },
        }),
      ]
    : [],
  callbacks: {
    async jwt({ token, account }) {
      const googleToken = applyGoogleAccountToToken(token as GoogleToken, account);
      if (account?.access_token) return { ...token, ...googleToken };
      if (!googleJwtNeedsRefresh(googleToken)) return { ...token, ...googleToken };
      const refreshed = await refreshGoogleAccessToken(googleToken);
      return { ...token, ...refreshed };
    },
    async session({ session, token }) {
      return attachGoogleAccessToSession(session, token as GoogleToken);
    },
  },
  session: {
    strategy: "jwt",
  },
});
