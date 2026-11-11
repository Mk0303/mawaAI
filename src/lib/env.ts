import "server-only";
import { z } from "zod";

/**
 * Server-only config. Validated once, lazily (so `next build` works without
 * secrets). In production the app refuses to serve if config is unsafe.
 */
const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_URL: z.preprocess(emptyToUndef, z.string().url().optional()),
  AUTH_TRUST_HOST: z.enum(["true", "false"]).optional(),
  AUTH_GOOGLE_ID: z.string().min(10).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(10).optional(),
  ALLOWED_EMAILS: z.string().optional(),
  DEV_LOGIN: z.enum(["true", "false"]).optional(),
  GROQ_API_KEY: z.string().min(10).optional(),
  GEMINI_API_KEY: z.string().min(10).optional(),
  ROUTER_LLM_CLASSIFIER: z.enum(["true", "false"]).optional(),
  DATABASE_PATH: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().min(10).optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/).optional(),
  TAVILY_API_KEY: z.string().min(10).optional(),
  POLLINATIONS_API_KEY: z.string().min(8).optional(),
});

export type AppEnv = {
  isProd: boolean;
  authSecret?: string;
  authUrl?: string;
  trustHost: boolean;
  google?: { id: string; secret: string };
  allowedEmails: Set<string>;
  devLogin: boolean;
  groqKey?: string;
  geminiKey?: string;
  llmClassifier: boolean;
  databasePath: string;
  cloudflare?: { token: string; accountId: string };
  tavilyKey?: string;
  pollinationsKey?: string;
};

let cached: AppEnv | null = null;

/** Test-only: drop the cached config so the next getEnv() re-reads process.env. */
export function resetEnvCacheForTests() {
  cached = null;
}

/** Keys that exist on the host but must never be used by this app. */
export const FORBIDDEN_ENV = ["OPENAI_API_KEY"] as const;
export function scrubForbiddenEnv() {
  for (const k of FORBIDDEN_ENV) delete process.env[k];
}

export class ConfigError extends Error {}

export function getEnv(): AppEnv {
  if (cached) return cached;
  scrubForbiddenEnv();
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Name the bad keys only, never values.
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new ConfigError(`Invalid server config: ${keys}`);
  }
  const e = parsed.data;
  const isProd = e.NODE_ENV === "production";
  const google = e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET ? { id: e.AUTH_GOOGLE_ID, secret: e.AUTH_GOOGLE_SECRET } : undefined;
  const allowedEmails = new Set(
    (e.ALLOWED_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  const authUrl = e.AUTH_URL;
  const env: AppEnv = {
    isProd,
    authSecret: e.AUTH_SECRET,
    authUrl,
    // Default on so Auth.js trusts X-Forwarded-Host/Proto behind a tunnel.
    trustHost: e.AUTH_TRUST_HOST !== "false",
    google,
    allowedEmails,
    // Dev login can never be on in production, whatever the env says.
    devLogin: !isProd && e.DEV_LOGIN === "true",
    groqKey: e.GROQ_API_KEY,
    geminiKey: e.GEMINI_API_KEY,
    llmClassifier: e.ROUTER_LLM_CLASSIFIER === "true",
    databasePath: e.DATABASE_PATH ?? "data/mawa.db",
    cloudflare: e.CLOUDFLARE_API_TOKEN && e.CLOUDFLARE_ACCOUNT_ID ? { token: e.CLOUDFLARE_API_TOKEN, accountId: e.CLOUDFLARE_ACCOUNT_ID } : undefined,
    tavilyKey: e.TAVILY_API_KEY,
    pollinationsKey: e.POLLINATIONS_API_KEY,
  };
  if (isProd && process.env.NEXT_PHASE !== "phase-production-build") {
    const missing: string[] = [];
    if (!env.authSecret) missing.push("AUTH_SECRET");
    // Google is optional until OAuth is set up: the server starts locked
    // (dev login is forced off, so nobody can sign in). Once Google is
    // configured, the allowlist is required so the app stays invite-only.
    if (env.google && env.allowedEmails.size === 0) missing.push("ALLOWED_EMAILS");
    if (env.authUrl && !env.authUrl.startsWith("https://")) missing.push("AUTH_URL (must be https in production)");
    if (missing.length) throw new ConfigError(`Production config missing: ${missing.join(", ")}`);
  }
  cached = env;
  return env;
}
