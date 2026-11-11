import "server-only";
import { getEnv } from "../env";
import { boundedFetch, ToolError } from "./fetch";

export interface GeneratedImage { data: Buffer; mime: "image/jpeg" | "image/png" | "image/webp"; provider: "Cloudflare" | "Pollinations" }

function sniff(buf: Buffer): GeneratedImage["mime"] | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export async function cloudflareFlux(prompt: string): Promise<GeneratedImage> {
  const cf = getEnv().cloudflare;
  if (!cf) throw new ToolError("not_configured", 401);
  const r = await boundedFetch(`https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
    method: "POST", timeoutMs: 45_000, maxBytes: 8 * 1024 * 1024,
    headers: { authorization: `Bearer ${cf.token}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt, steps: 4 }),
  });
  if (r.status !== 200) throw new ToolError("http_" + r.status, r.status);
  let b64: unknown;
  try { b64 = (JSON.parse(r.body.toString("utf8")) as { result?: { image?: unknown } }).result?.image; } catch { /* fallthrough */ }
  if (typeof b64 !== "string") throw new ToolError("bad_response", 502);
  const data = Buffer.from(b64, "base64");
  const mime = sniff(data);
  if (!mime) throw new ToolError("not_an_image", 502);
  return { data, mime, provider: "Cloudflare" };
}

export async function pollinations(prompt: string): Promise<GeneratedImage> {
  const key = getEnv().pollinationsKey;
  if (!key) throw new ToolError("not_configured", 401);
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=black-forest-labs%2Fflux.1-schnell&width=1024&height=1024&seed=${Math.floor(Math.random() * 1e6)}`;
  const r = await boundedFetch(url, { method: "GET", timeoutMs: 60_000, maxBytes: 8 * 1024 * 1024, headers: { authorization: `Bearer ${key}` } });
  if (r.status !== 200) throw new ToolError("http_" + r.status, r.status);
  const mime = sniff(r.body);
  if (!mime) throw new ToolError("not_an_image", 502);
  return { data: r.body, mime, provider: "Pollinations" };
}

export function imageGenAvailable(): boolean {
  const e = getEnv();
  return !!e.cloudflare || !!e.pollinationsKey;
}

/** Cloudflare flux-1-schnell first, Pollinations (only if its key exists) as fallback. */
export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const clean = prompt.replace(/[\u0000-\u001f]/g, " ").slice(0, 1000);
  let last: unknown;
  for (const fn of [cloudflareFlux, pollinations]) {
    try { return await fn(clean); } catch (e) { last = e; }
  }
  throw last instanceof ToolError ? last : new ToolError("all_failed", 502);
}
