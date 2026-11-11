import { test } from "node:test";
import assert from "node:assert/strict";
import { SqliteStore } from "../src/lib/db/sqlite";
import { chunkConversation } from "../src/lib/memory";

test("threads and imports are scoped per user (no IDOR)", () => {
  const s = new SqliteStore(":memory:");
  const a = s.upsertUser({ email: "a@x.com", name: "A" });
  const b = s.upsertUser({ email: "b@x.com", name: "B" });
  const t = s.createThread(a.id, "secret");
  s.addMessage(a.id, { threadId: t.id, role: "user", content: "hi", model: null, intent: null, mood: null, ms: null });
  assert.equal(s.getThread(b.id, t.id), null);
  assert.deepEqual(s.listMessages(b.id, t.id, 10), []);
  assert.equal(s.deleteThread(b.id, t.id), false);
  assert.throws(() => s.addMessage(b.id, { threadId: t.id, role: "user", content: "x", model: null, intent: null, mood: null, ms: null }));

  const imp = s.saveImport(a.id, "chatgpt", [{ extId: "c1", title: "Biking plans", createdAt: 1, messages: [{ role: "user", content: "I love biking in Hyderabad", at: 1 }] }]);
  s.addChunks(a.id, imp.importId, chunkConversation("Biking plans", [{ role: "user", content: "I love biking in Hyderabad" }]).map((text) => ({ source: "chatgpt" as const, refId: imp.convIds[0]!, title: "Biking plans", text })));
  assert.equal(s.search(a.id, "where do I go biking?", 3).length, 1);
  assert.equal(s.search(b.id, "where do I go biking?", 3).length, 0);
  assert.equal(s.getImportedConversation(b.id, imp.convIds[0]!), null);
  assert.equal(s.deleteImport(b.id, imp.importId), false);

  // Re-import of the same export skips duplicates.
  const again = s.saveImport(a.id, "chatgpt", [{ extId: "c1", title: "Biking plans", createdAt: 1, messages: [{ role: "user", content: "dup", at: 1 }] }]);
  assert.equal(again.duplicates, 1);

  s.setProfile(a.id, "Likes biking.");
  assert.ok(s.deleteAllImports(a.id) >= 1);
  assert.equal(s.getProfile(a.id), null);
  assert.equal(s.search(a.id, "biking", 3).length, 0);
  assert.equal(s.listImportedConversations(a.id, 10).length, 0);
});

test("FTS query input is sanitised (no FTS syntax injection)", () => {
  const s = new SqliteStore(":memory:");
  const a = s.upsertUser({ email: "a@x.com", name: "A" });
  assert.deepEqual(s.search(a.id, '"); DROP TABLE users; -- NEAR( * ', 3), []);
  assert.ok(s.upsertUser({ email: "a@x.com", name: "A" }).id === a.id);
});
