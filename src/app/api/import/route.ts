import { z } from "zod";
import { api, jsonError } from "@/lib/http";
import { getStore } from "@/lib/db";
import { importExport } from "@/lib/import/service";
import { ImportError, IMPORT_LIMITS } from "@/lib/import/types";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NAME_OK = /\.(zip|json|html?)$/i;

export const POST = api(async (req, u) => {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > IMPORT_LIMITS.maxUploadBytes + 64 * 1024) return jsonError(413, "That file is over 200 MB, a bit much for me right now.", u.reqId);
  let form: FormData;
  try { form = await req.formData(); } catch { return jsonError(400, "The upload didn't come through. Try once more.", u.reqId); }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "Pick your export file first.", u.reqId);
  if (file.size > IMPORT_LIMITS.maxUploadBytes) return jsonError(413, "That file is over 200 MB, a bit much for me right now.", u.reqId);
  const name = file.name.slice(0, 200);
  if (!NAME_OK.test(name)) return jsonError(400, "That's not the export file. Look for a .zip from the ChatGPT or Google email.", u.reqId);
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const summary = await importExport(u.userId, name, buf);
    log("info", "import_ok", { reqId: u.reqId, uid: u.userId, source: summary.source, convs: summary.conversations, msgs: summary.messages });
    return Response.json(summary);
  } catch (e) {
    if (e instanceof ImportError) {
      log("warn", "import_rejected", { reqId: u.reqId, uid: u.userId, code: e.code });
      return jsonError(422, e.friendly, u.reqId);
    }
    throw e;
  }
}, { limit: [{ key: "import", max: 5, windowMs: 10 * 60_000 }] });

export const GET = api(async (_req, u) => {
  const s = getStore();
  return Response.json({ imports: s.listImports(u.userId), profile: s.getProfile(u.userId) });
});

/** DELETE /api/import            -> remove all imported data + profile
 *  DELETE /api/import?id=<uuid>  -> remove one import batch */
export const DELETE = api(async (req, u) => {
  const id = new URL(req.url).searchParams.get("id");
  const s = getStore();
  if (id) {
    const p = z.uuid().safeParse(id);
    if (!p.success || !s.deleteImport(u.userId, p.data)) return jsonError(404, "Not found.", u.reqId);
    log("info", "import_deleted", { reqId: u.reqId, uid: u.userId, scope: "one" });
    return Response.json({ ok: true });
  }
  const n = s.deleteAllImports(u.userId);
  log("info", "import_deleted", { reqId: u.reqId, uid: u.userId, scope: "all", count: n });
  return Response.json({ ok: true, deleted: n });
});
