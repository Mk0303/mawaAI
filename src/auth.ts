import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getStore } from "@/lib/db";
import { log } from "@/lib/log";

declare module "next-auth" {
  interface Session { user: { id: string; name?: string | null; email?: string | null; image?: string | null } }
}

const devName = z.string().trim().min(1).max(40).regex(/^[\p{L}\p{N} ._-]+$/u);

export const { handlers, auth, signIn, signOut } = NextAuth((): NextAuthConfig => {
  const env = getEnv();
  const providers: NextAuthConfig["providers"] = [];
  if (env.google) providers.push(Google({ clientId: env.google.id, clientSecret: env.google.secret }));
  if (env.devLogin) {
    providers.push(Credentials({
      id: "dev",
      name: "Local dev login",
      credentials: { name: { label: "Name", type: "text" } },
      authorize(creds) {
        const parsed = devName.safeParse(creds?.name);
        if (!parsed.success) return null;
        const slug = parsed.data.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "dev";
        return { id: slug, name: parsed.data, email: `${slug}@dev.local` };
      },
    }));
  }
  return {
    providers,
    secret: env.authSecret,
    trustHost: env.trustHost,
    session: { strategy: "jwt", maxAge: 7 * 24 * 3600 },
    pages: { signIn: "/login", error: "/login" },
    callbacks: {
      signIn({ account, profile, user }) {
        if (account?.provider === "google") {
          const email = (profile?.email ?? "").toLowerCase();
          if (!email || profile?.email_verified !== true) return false;
          // Allowlist: friends only. Empty list is allowed only in local dev.
          if (env.allowedEmails.size === 0 ? env.isProd : !env.allowedEmails.has(email)) {
            log("warn", "auth_denied", { reason: "not_allowlisted" });
            return false;
          }
          return true;
        }
        if (account?.provider === "dev") return env.devLogin && !!user.email;
        return false;
      },
      jwt({ token, user, account }) {
        if (account && user?.email) {
          const row = getStore().upsertUser({ email: user.email, name: user.name ?? null });
          token.uid = row.id;
          log("info", "auth_login", { provider: account.provider, uid: row.id });
        }
        return token;
      },
      session({ session, token }) {
        if (typeof token.uid === "string") session.user.id = token.uid;
        return session;
      },
    },
  };
});
