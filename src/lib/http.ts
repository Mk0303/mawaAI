import "server-only";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { log } from "./log";
import { rateLimiter } from "./rate-limit";
import { ConfigError, getEnv } from "./env";

export type Authed = { userId: string; name: string | null; reqId: string };

export function jsonError(status: number, message: string, reqId: string, extra: Record<string, string> = {}) {
  return Response.json({ error: message, requestId: reqId }, { status, headers: { "cache-control": "no-store", ...extra } });
}

/** CSRF defence for cookie-authenticated writes: Origin must match the public host. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host;
    // Prefer the configured public URL so a spoofed X-Forwarded-Host cannot pass.
    const authUrl = getEnv().authUrl;
    if (authUrl) return originHost === new URL(authUrl).host;
    const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0]!.trim();
    if (!host) return false;
    return originHost === host;
  } catch {
    return false;
  }
}

interface Opts { limit?: { key: string; max: number; windowMs: number }[]; maxBodyBytes?: number }

/**
 * Wrap every API route: request id, auth (deny by default), origin check on
 * writes, rate limits, body size cap, and safe error responses (A01/A07/A10).
 */
export function api(handler: (req: Request, u: Authed, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>, opts: Opts = {}) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    const reqId = randomUUID();
    try {
      if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) {
        log("warn", "csrf_block", { reqId, path: new URL(req.url).pathname });
        return jsonError(403, "Forbidden", reqId);
      }
      const session = await auth();
      const userId = session?.user?.id;
      if (!userId) {
        log("warn", "auth_required", { reqId, path: new URL(req.url).pathname });
        return jsonError(401, "Please sign in first.", reqId);
      }
      for (const l of opts.limit ?? [{ key: "api", max: 120, windowMs: 60_000 }]) {
        const r = rateLimiter.hit(`${l.key}:${userId}`, l.max, l.windowMs);
        if (!r.ok) {
          log("warn", "rate_limited", { reqId, uid: userId, key: l.key });
          return jsonError(429, "Easy there, speedster. Try again in a bit.", reqId, { "retry-after": String(r.retryAfterSec) });
        }
      }
      const len = Number(req.headers.get("content-length") ?? 0);
      if (opts.maxBodyBytes !== undefined && len > opts.maxBodyBytes) return jsonError(413, "That's too big to send.", reqId);
      return await handler(req, { userId, name: session.user.name ?? null, reqId }, ctx);
    } catch (e) {
      log("error", "api_error", { reqId, kind: e instanceof ConfigError ? "config" : e instanceof Error ? e.name : "unknown" });
      return jsonError(500, "Something broke on my side. Try again.", reqId);
    }
  };
}

/** Read a JSON body with a hard byte cap (content-length can lie). */
export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) throw new BodyTooLarge();
  try { return JSON.parse(text); } catch { return undefined; }
}
export class BodyTooLarge extends Error {}
