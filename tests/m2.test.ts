import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SqliteStore } from "../src/lib/db/sqlite";
import { chunkText } from "../src/lib/memory";
import { safeSource } from "../src/lib/tools/search";
import { extractPdf, isPdf, PdfError } from "../src/lib/tools/pdf";
import { audioMimeOk } from "../src/lib/tools/stt";
import { rulesClassify } from "../src/lib/router/classifier";
import { Router } from "../src/lib/router/router";
import { MemoryQuota } from "../src/lib/router/quota";
import { buildModels } from "../src/lib/router/registry";
import type { ModelCapability, ProviderAdapter } from "../src/lib/router/types";

const ok = (id: ModelCapability["providerId"]): ProviderAdapter => ({ id, available: () => true, async *stream() { yield "ok"; } }) as unknown as ProviderAdapter;

test("search sources: only http(s) URLs survive, titles are bounded", () => {
  assert.equal(safeSource("javascript:alert(1)", "x"), null);
  assert.equal(safeSource("data:text/html,hi", "x"), null);
  assert.equal(safeSource("not a url", "x"), null);
  const s = safeSource("https://www.example.com/a?b=1", "T".repeat(500));
  assert.ok(s);
  assert.equal(s!.host, "example.com");
  assert.ok(s!.title.length <= 200);
});

test("media is owner-scoped and paths can't escape", () => {
  const s = new SqliteStore(":memory:");
  const a = s.upsertUser({ email: "a@x.com", name: "A" });
  const b = s.upsertUser({ email: "b@x.com", name: "B" });
  const m = s.saveMedia(a.id, { kind: "photo", mime: "image/png", name: "me.png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) });
  assert.ok(s.readMediaBytes(a.id, m.id));
  assert.equal(s.readMediaBytes(b.id, m.id), null);
  assert.equal(s.getMedia(b.id, m.id), null);
  assert.equal(s.readMediaBytes(a.id, "../../etc/passwd"), null);
  const t = s.createThread(a.id, "x");
  const tb = s.createThread(b.id, "y");
  const doc = s.saveMedia(a.id, { kind: "pdf", mime: "application/pdf", name: "d.pdf", data: Buffer.from("%PDF-"), pages: 1, text: "hello" });
  s.linkMediaToThread(b.id, [doc.id], tb.id); // B can't steal A's doc
  assert.equal(s.threadDocs(b.id, tb.id).length, 0);
  s.linkMediaToThread(a.id, [doc.id], t.id);
  assert.equal(s.threadDocs(a.id, t.id).length, 1);
  assert.throws(() => s.saveMedia(a.id, { kind: "photo", mime: "text/html" as "image/png", name: null, data: Buffer.from("x") }));
});

test("daily usage counters are per user and per kind", () => {
  const s = new SqliteStore(":memory:");
  const a = s.upsertUser({ email: "a@x.com", name: "A" });
  const b = s.upsertUser({ email: "b@x.com", name: "B" });
  for (let i = 0; i < 3; i++) s.bumpUsage(a.id, "image");
  assert.equal(s.getUsage(a.id, "image"), 3);
  assert.equal(s.getUsage(a.id, "search"), 0);
  assert.equal(s.getUsage(b.id, "image"), 0);
});

test("PDF extraction keeps page markers and rejects non-PDFs", async () => {
  const buf = readFileSync(join(__dirname, "fixtures/sample.pdf"));
  assert.ok(isPdf(buf));
  const r = await extractPdf(buf);
  assert.equal(r.pages, 2);
  assert.match(r.text, /\[Page 1\][\s\S]*25000[\s\S]*\[Page 2\][\s\S]*30 days/);
  await assert.rejects(extractPdf(Buffer.from("%PDF-1.4 garbage")), PdfError);
  assert.ok(chunkText("a".repeat(4000), 1500).every((c) => c.length <= 1500));
});

const D1 = "11111111-1111-4111-8111-111111111111", D2 = "22222222-2222-4222-8222-222222222222";
test("doc chunks are searchable only within the chosen docs", () => {
  const s = new SqliteStore(":memory:");
  const a = s.upsertUser({ email: "a@x.com", name: "A" });
  s.addChunks(a.id, null, [{ source: "doc", refId: D1, title: "Lease", text: "The notice period is 30 days." }, { source: "doc", refId: D2, title: "Other", text: "notice nothing" }]);
  const hits = s.searchIn(a.id, [D1], "what's the notice period?", 5);
  assert.equal(hits.length, 1);
  assert.match(hits[0]!, /30 days/);
});

test("audio mime allowlist", () => {
  for (const m of ["audio/webm", "audio/mp4", "audio/webm;codecs=opus", "audio/x-m4a", "audio/aac"]) assert.ok(audioMimeOk(m), m);
  for (const m of ["text/html", "application/x-sh", "video/mp4; evil"]) assert.ok(!audioMimeOk(m), m);
});

test("vision requests only route to vision models; image/web intents classify", () => {
  const models = buildModels({});
  const r = new Router(models, { groq: ok("groq"), gemini: ok("gemini"), openrouter: ok("openrouter"), cloudflare: ok("cloudflare") }, new MemoryQuota());
  const cls = { intent: "vision" as const, needsVision: true, needsLongContext: false, sensitive: false, confidence: 1, source: "rules" as const };
  const chain = r.route(cls, 2000).chain;
  assert.ok(chain.length > 0);
  assert.ok(chain.every((id) => models.find((m) => m.id === id)!.vision), chain.join());
  assert.equal(rulesClassify({ text: "generate an image of a cat on a bike", historyTokens: 0 })?.intent, "image_gen");
  assert.equal(rulesClassify({ text: "latest news about ISRO today", historyTokens: 0 })?.intent, "web");
});

test("the app never reads OPENAI_API_KEY", () => {
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mts|js|mjs)$/.test(f)) {
        const src = readFileSync(p, "utf8");
        // Allowed only in the code that deletes / forbids it.
        for (const line of src.split("\n")) if (/OPENAI_API_KEY/.test(line) && !/delete process\.env\.OPENAI_API_KEY|FORBIDDEN_ENV|\/\/|\*/.test(line)) hits.push(`${p}: ${line.trim()}`);
      }
    }
  };
  walk(join(__dirname, "../src"));
  walk(join(__dirname, "../scripts"));
  assert.deepEqual(hits, []);
});

test("a 402 (billing required) parks the model for an hour", () => {
  const q = new MemoryQuota();
  const m = buildModels({}).find((x) => x.id === "sambanova:gpt-oss-120b")!;
  const now = Date.now();
  q.penalize(m, 402, undefined, now);
  assert.ok(q.snapshot(m, now + 30 * 60_000).coolDownUntil > now + 30 * 60_000);
});
