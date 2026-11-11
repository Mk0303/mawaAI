import { z } from "zod";
import { api, jsonError } from "@/lib/http";
import { getStore } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api(async (_req, u, ctx) => {
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return jsonError(404, "Chat not found.", u.reqId);
  const r = getStore().getImportedConversation(u.userId, id.data);
  if (!r) return jsonError(404, "Chat not found.", u.reqId);
  return Response.json({ conversation: r.conv, messages: r.messages });
});
