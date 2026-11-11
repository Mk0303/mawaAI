import { api, jsonError } from "@/lib/http";
import { getStore } from "@/lib/db";
import { extractPdf, isPdf, PDF_LIMITS, PdfError } from "@/lib/tools/pdf";
import { chunkText } from "@/lib/memory";
import { takeQuota, OVER_LIMIT_TEXT } from "@/lib/usage";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_MAX = 8 * 1024 * 1024;

/** Detect type from magic bytes; the browser-supplied type and name are not trusted. */
function sniffImage(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (b.subarray(0, 6).toString("ascii") === "GIF87a" || b.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  return null;
}

export const POST = api(async (req, u) => {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > PDF_LIMITS.maxBytes + 64 * 1024) return jsonError(413, "That file is over 20 MB. Try a smaller one.", u.reqId);
  let form: FormData;
  try { form = await req.formData(); } catch { return jsonError(400, "The upload didn't come through. Try again.", u.reqId); }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "Pick a photo or PDF first.", u.reqId);
  if (file.size > PDF_LIMITS.maxBytes) return jsonError(413, "That file is over 20 MB. Try a smaller one.", u.reqId);
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.slice(0, 120) || null;
  const store = getStore();

  const img = sniffImage(buf);
  if (!img && !isPdf(buf)) return jsonError(415, "I can read photos (JPG, PNG, WebP) and PDFs. That one's neither.", u.reqId);
  if (img && buf.length > IMAGE_MAX) return jsonError(413, "That photo is over 8 MB. Send a smaller one.", u.reqId);
  if (!takeQuota(u.userId, "upload")) return jsonError(429, OVER_LIMIT_TEXT.upload, u.reqId);

  if (img) {
    const row = store.saveMedia(u.userId, { kind: "photo", mime: img, name, data: buf });
    log("info", "upload_ok", { reqId: u.reqId, uid: u.userId, kind: "photo", bytes: buf.length });
    return Response.json({ id: row.id, kind: "photo", name: row.name, url: `/api/media/${row.id}` });
  }
  try {
    const { text, pages } = await extractPdf(buf);
    const row = store.saveMedia(u.userId, { kind: "pdf", mime: "application/pdf", name, data: buf, pages, text });
    const title = row.name ?? "Document";
    // Page-aware chunks for retrieval when the whole doc doesn't fit a model.
    store.addChunks(u.userId, null, chunkText(text, 1500).map((t) => ({ source: "doc" as const, refId: row.id, title, text: t })));
    log("info", "upload_ok", { reqId: u.reqId, uid: u.userId, kind: "pdf", pages, chars: text.length });
    return Response.json({ id: row.id, kind: "pdf", name: row.name, pages, url: `/api/media/${row.id}` });
  } catch (e) {
    if (e instanceof PdfError) return jsonError(422, e.friendly, u.reqId);
    throw e;
  }
}, { limit: [{ key: "upload", max: 10, windowMs: 60_000 }] });
