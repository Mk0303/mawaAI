import "server-only";
import { spawn } from "node:child_process";
import { getEnv } from "../env";
import { boundedFetch, ToolError } from "./fetch";

export const AUDIO_LIMITS = { maxBytes: 12 * 1024 * 1024, maxSeconds: 180 } as const;
const AUDIO_MIME = /^audio\/(webm|mp4|m4a|x-m4a|aac|mpeg|mp3|ogg|wav|x-wav)(;.*)?$/i;

export function audioMimeOk(mime: string): boolean { return AUDIO_MIME.test(mime); }

/** Normalise to 16 kHz mono WAV with ffmpeg when available (array args, no shell, time + size bounded). */
function toWav(input: Buffer): Promise<Buffer | null> {
  return new Promise((resolve) => {
    let p;
    try {
      p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-t", String(AUDIO_LIMITS.maxSeconds), "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"], { stdio: ["pipe", "pipe", "ignore"] });
    } catch { return resolve(null); }
    const out: Buffer[] = [];
    let n = 0;
    const timer = setTimeout(() => { p.kill("SIGKILL"); resolve(null); }, 20_000);
    p.on("error", () => { clearTimeout(timer); resolve(null); });
    p.stdout.on("data", (c: Buffer) => { n += c.length; if (n > 16 * 1024 * 1024) p.kill("SIGKILL"); else out.push(c); });
    p.on("close", (code) => { clearTimeout(timer); resolve(code === 0 && n > 44 ? Buffer.concat(out) : null); });
    p.stdin.on("error", () => undefined);
    p.stdin.end(input);
  });
}

export async function cloudflareWhisper(audio: Buffer): Promise<string> {
  const cf = getEnv().cloudflare;
  if (!cf) throw new ToolError("not_configured", 401);
  const wav = (await toWav(audio)) ?? audio;
  const r = await boundedFetch(`https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/ai/run/@cf/openai/whisper-large-v3-turbo`, {
    method: "POST", timeoutMs: 45_000, maxBytes: 1024 * 1024,
    headers: { authorization: `Bearer ${cf.token}`, "content-type": "application/json" },
    body: JSON.stringify({ audio: wav.toString("base64"), task: "transcribe", vad_filter: true }),
  });
  if (r.status !== 200) throw new ToolError("http_" + r.status, r.status);
  try {
    const t = (JSON.parse(r.body.toString("utf8")) as { result?: { text?: unknown } }).result?.text;
    if (typeof t === "string") return t;
  } catch { /* fallthrough */ }
  throw new ToolError("bad_response", 502);
}

export async function groqWhisper(audio: Buffer, mime: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new ToolError("not_configured", 401);
  const ext = /mp4|m4a|aac/i.test(mime) ? "m4a" : /ogg/i.test(mime) ? "ogg" : /wav/i.test(mime) ? "wav" : /mpeg|mp3/i.test(mime) ? "mp3" : "webm";
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(audio)], { type: mime.split(";")[0] }), `voice.${ext}`);
  fd.append("model", "whisper-large-v3-turbo");
  fd.append("response_format", "json");
  const r = await boundedFetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST", timeoutMs: 45_000, maxBytes: 1024 * 1024, headers: { authorization: `Bearer ${key}` }, body: fd,
  });
  if (r.status !== 200) throw new ToolError("http_" + r.status, r.status);
  try {
    const t = (JSON.parse(r.body.toString("utf8")) as { text?: unknown }).text;
    if (typeof t === "string") return t;
  } catch { /* fallthrough */ }
  throw new ToolError("bad_response", 502);
}

export function sttAvailable() { return !!getEnv().cloudflare || !!process.env.GROQ_API_KEY; }

/** Cloudflare whisper-large-v3-turbo first, Groq whisper as the alternate. */
export async function transcribe(audio: Buffer, mime: string, prefer: "cloudflare" | "groq" = "cloudflare"): Promise<{ text: string; provider: string }> {
  const order = prefer === "groq" ? (["groq", "cloudflare"] as const) : (["cloudflare", "groq"] as const);
  let last: unknown;
  for (const p of order) {
    try {
      const text = p === "cloudflare" ? await cloudflareWhisper(audio) : await groqWhisper(audio, mime);
      return { text: text.trim().slice(0, 8000), provider: p === "cloudflare" ? "Cloudflare Whisper" : "Groq Whisper" };
    } catch (e) { last = e; }
  }
  throw last instanceof ToolError ? last : new ToolError("all_failed", 502);
}
