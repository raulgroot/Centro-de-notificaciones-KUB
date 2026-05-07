import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-compatible Auth.js config (no Node-specific imports).
 * Used both by the full auth runtime and by middleware on the Edge.
 *
 * Domain restriction: only emails ending in @kublau.com can sign in.
 * The check runs on every sign-in via the `signIn` callback.
 */

const ALLOWED_DOMAIN = "kublau.com";

export const authConfig = {
  providers: [Google],
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;
      const domain = email.split("@")[1];
      return domain === ALLOWED_DOMAIN;
    },
    async session({ session, token }) {
      if (token.email && session.user) {
        session.user.email = token.email;
      }
      return session;
    },
    authorized({ auth, request }) {
      // In local development, bypass auth so design previews and quick testing
      // don't require logging in. Production (Vercel) sets NODE_ENV=production
      // automatically — gating stays fully active there.
      if (process.env.NODE_ENV !== "production") return true;

      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      // Public routes
      if (pathname.startsWith("/login")) return true;
      if (pathname.startsWith("/api/auth")) return true;
      if (pathname.startsWith("/api/health")) return true;
      // Everything else requires auth
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
