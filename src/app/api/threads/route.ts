import { api } from "@/lib/http";
import { getStore } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sidebar: own chats plus imported ones (marked). */
export const GET = api(async (_req, u) => {
  const store = getStore();
  const threads = store.listThreads(u.userId, 100).map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt, kind: "chat" as const }));
  const imported = store.listImportedConversations(u.userId, 300).map((c) => ({ id: c.id, title: c.title, updatedAt: c.createdAt ?? 0, kind: "imported" as const, source: c.source }));
  return Response.json({ threads, imported });
});
