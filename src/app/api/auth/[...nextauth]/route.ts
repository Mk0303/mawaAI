import { handlers } from "@/auth";
import { rateLimiter, LIMITS } from "@/lib/rate-limit";

export const GET = handlers.GET;

/** Rate-limit sign-in attempts per client IP (A07). */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0]!.trim().slice(0, 64);
  const r = rateLimiter.hit(`login:${ip}`, LIMITS.loginPerMin, 60_000);
  if (!r.ok) return Response.json({ error: "Too many tries. Wait a minute." }, { status: 429, headers: { "retry-after": String(r.retryAfterSec) } });
  return handlers.POST(req as Parameters<typeof handlers.POST>[0]);
}
