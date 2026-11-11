import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseExport } from "../src/lib/import/parse";
import { ImportError } from "../src/lib/import/types";

const fx = (n: string) => fs.readFileSync(path.join(import.meta.dirname, "fixtures", n));

test("ChatGPT zip as-is: active branch only, system and non-text parts skipped", async () => {
  const r = await parseExport("chatgpt-export.zip", fx("chatgpt-export.zip"));
  assert.equal(r.source, "chatgpt");
  assert.equal(r.conversations.length, 2);
  assert.equal(r.skipped, 1);
  const c = r.conversations[0]!;
  assert.equal(c.title, "Fix my React useEffect");
  assert.deepEqual(c.messages.map((m) => m.role), ["user", "assistant", "user"]);
  assert.ok(!c.messages.some((m) => m.content.includes("old branch")));
  assert.equal(c.messages[2]!.content, "Thanks! Also I love biking in Hyderabad.");
});

test("ChatGPT inner conversations.json is accepted too", async () => {
  const r = await parseExport("conversations.json", fx("chatgpt-conversations.json"));
  assert.equal(r.source, "chatgpt");
  assert.equal(r.conversations.length, 2);
});

test("Gemini Takeout zip (HTML) auto-detected and grouped by day; scripts dropped", async () => {
  const r = await parseExport("takeout-20261110.zip", fx("gemini-takeout.zip"));
  assert.equal(r.source, "gemini");
  assert.equal(r.conversations.length, 2);
  const all = r.conversations.flatMap((c) => c.messages);
  const prompts = all.filter((m) => m.role === "user").map((m) => m.content);
  assert.ok(prompts.includes("plan a weekend trip to Kamshet for paragliding"));
  assert.ok(prompts.includes("explain ESP32-S3 deep sleep"));
  assert.ok(!prompts.some((p) => /Assistant feature/.test(p)));
  assert.ok(!all.some((m) => m.content.includes("alert(1)")));
  assert.ok(all.some((m) => m.role === "assistant" && m.content.includes("Day 1")));
});

test("Gemini MyActivity.json accepted directly", async () => {
  const r = await parseExport("MyActivity.json", fx("gemini-MyActivity.json"));
  assert.equal(r.source, "gemini");
  const msgs = r.conversations.flatMap((c) => c.messages);
  assert.equal(msgs.filter((m) => m.role === "user").length, 2);
  assert.ok(msgs.some((m) => m.content.includes("monsoon whispers")));
});

test("Gemini HTML file accepted directly", async () => {
  const r = await parseExport("MyActivity.html", fx("gemini-MyActivity.html"));
  assert.equal(r.source, "gemini");
});

for (const [name, why] of [
  ["evil-traversal.zip", "path traversal"],
  ["zip-bomb.zip", "zip bomb (high ratio)"],
  ["random.zip", "zip without chats"],
  ["not-an-export.json", "unrelated json"],
] as const) {
  test(`rejects ${why} with a friendly error`, async () => {
    await assert.rejects(parseExport(name, fx(name)), (e: unknown) => {
      assert.ok(e instanceof ImportError);
      assert.ok(e.friendly.length > 10 && !/stack|undefined|null/i.test(e.friendly));
      return true;
    });
  });
}

test("rejects empty and corrupt files", async () => {
  await assert.rejects(parseExport("x.zip", Buffer.alloc(0)), ImportError);
  await assert.rejects(parseExport("x.zip", Buffer.from("PK\x03\x04garbage-garbage-garbage")), ImportError);
});
