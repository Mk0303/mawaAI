import { z } from "zod";
import { api, jsonError } from "@/lib/http";
import { getStore } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serve a user's own media. Owner-scoped; PDFs always download (never render inline). */
export const GET = api(async (req, u, ctx) => {
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return jsonError(404, "Not found.", u.reqId);
  const r = getStore().readMediaBytes(u.userId, id.data);
  if (!r) return jsonError(404, "Not found.", u.reqId);
  const download = new URL(req.url).searchParams.get("download") === "1" || r.row.mime === "application/pdf";
  const ext = r.row.mime.split("/")[1]!.replace("jpeg", "jpg");
  const base = (r.row.name ?? (r.row.kind === "image_gen" ? "mawa-ai-image" : "file")).replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[^A-Za-z0-9 ._-]/g, "_").slice(0, 80);
  return new Response(new Uint8Array(r.data), {
    headers: {
      "content-type": r.row.mime,
      "content-length": String(r.data.length),
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${base}.${ext}"`,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}, { limit: [{ key: "media", max: 300, windowMs: 60_000 }] });
