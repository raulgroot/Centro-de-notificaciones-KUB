import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Auth.js entrypoint. Re-exports `auth` for Server Components / Route Handlers,
 * and `signIn` / `signOut` for forms.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
