import { api, jsonError } from "@/lib/http";
import { AUDIO_LIMITS, audioMimeOk, sttAvailable, transcribe } from "@/lib/tools/stt";
import { takeQuota, OVER_LIMIT_TEXT } from "@/lib/usage";
import { log } from "@/lib/log";
import { ToolError } from "@/lib/tools/fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api(async (req, u) => {
  if (!sttAvailable()) return jsonError(503, "Voice isn't set up yet.", u.reqId);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > AUDIO_LIMITS.maxBytes + 32 * 1024) return jsonError(413, "That recording is too long. Keep it under 3 minutes.", u.reqId);
  let form: FormData;
  try { form = await req.formData(); } catch { return jsonError(400, "The recording didn't come through. Try again.", u.reqId); }
  const file = form.get("audio");
  if (!(file instanceof File) || file.size === 0) return jsonError(400, "I didn't get any audio.", u.reqId);
  if (file.size > AUDIO_LIMITS.maxBytes) return jsonError(413, "That recording is too long. Keep it under 3 minutes.", u.reqId);
  const mime = file.type || "audio/webm";
  if (!audioMimeOk(mime)) return jsonError(415, "Your browser sent audio I can't read.", u.reqId);
  if (!takeQuota(u.userId, "voice")) return jsonError(429, OVER_LIMIT_TEXT.voice, u.reqId);
  const prefer = new URL(req.url).searchParams.get("engine") === "groq" ? "groq" : "cloudflare";
  try {
    const r = await transcribe(Buffer.from(await file.arrayBuffer()), mime, prefer);
    log("info", "stt_ok", { reqId: u.reqId, uid: u.userId, provider: r.provider, chars: r.text.length });
    return Response.json(r);
  } catch (e) {
    log("warn", "stt_failed", { reqId: u.reqId, uid: u.userId, code: e instanceof ToolError ? e.code : "unknown" });
    return jsonError(502, "Couldn't catch that. Try again, a bit closer to the mic.", u.reqId);
  }
}, { limit: [{ key: "stt", max: 12, windowMs: 60_000 }] });
