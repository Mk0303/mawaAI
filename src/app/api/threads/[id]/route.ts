import { z } from "zod";
import { api, jsonError } from "@/lib/http";
import { getStore } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Id = z.uuid();

export const GET = api(async (_req, u, ctx) => {
  const id = Id.safeParse((await ctx.params).id);
  if (!id.success) return jsonError(404, "Chat not found.", u.reqId);
  const store = getStore();
  const thread = store.getThread(u.userId, id.data);
  if (!thread) return jsonError(404, "Chat not found.", u.reqId);
  const messages = store.listMessages(u.userId, thread.id, 400).map((m) => ({ id: m.id, role: m.role, content: m.content, model: m.model, mood: m.mood, ms: m.ms, attachments: m.attachments, sources: m.sources }));
  return Response.json({ thread: { id: thread.id, title: thread.title }, messages });
});

export const DELETE = api(async (_req, u, ctx) => {
  const id = Id.safeParse((await ctx.params).id);
  if (!id.success) return jsonError(404, "Chat not found.", u.reqId);
  if (!getStore().deleteThread(u.userId, id.data)) return jsonError(404, "Chat not found.", u.reqId);
  return Response.json({ ok: true });
});
