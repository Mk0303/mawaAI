import { test } from "node:test";
import assert from "node:assert/strict";
import { rulesClassify, parseClassifierJson } from "../src/lib/router/classifier";
import { Router, BUSY_TEXT } from "../src/lib/router/router";
import { MemoryQuota } from "../src/lib/router/quota";
import { buildModels } from "../src/lib/router/registry";
import { fitContext } from "../src/lib/router/context";
import { MockAdapter } from "../src/lib/providers/mock";
import { ProviderError, type ChatMessage, type ModelCapability, type ProviderAdapter, type StreamOptions } from "../src/lib/router/types";
import { personaPrompt, effectiveVibe, isCare } from "../src/lib/persona";

test("rules classify common intents with zero model calls", () => {
  const c = (text: string) => rulesClassify({ text, historyTokens: 0 })?.intent;
  assert.equal(c("I get a TypeError in my typescript function, here's the stack trace and the code that throws it"), "code");
  assert.equal(c("draw an image of a cat riding a bike through Hyderabad at night with neon lights"), "image_gen");
  assert.equal(c("hi"), "quick");
  assert.equal(rulesClassify({ text: "anything", category: "video", historyTokens: 0 })?.intent, "video_gen");
});

test("classifier JSON from a model is validated", () => {
  const base = { needsLongContext: false, sensitive: false };
  assert.equal(parseClassifierJson('{"intent":"code","confidence":0.9}', base)?.intent, "code");
  assert.equal(parseClassifierJson('{"intent":"rm -rf"}', base), null);
  assert.equal(parseClassifierJson("not json", base), null);
});

test("care override on sensitive topics; vibe steering clamps", () => {
  assert.ok(isCare({ sensitive: false }, "my dad died last week"));
  assert.ok(isCare({ sensitive: false }, "I lost my job and can't pay rent"));
  assert.ok(!isCare({ sensitive: false }, "roast my code"));
  const p = personaPrompt({ vibe: "full_roast", mawa: true, care: true, intent: "chat" });
  assert.match(p, /MODE: care/);
  assert.match(p, /Never joke about race, religion, caste/);
  assert.equal(effectiveVibe("full_roast", "harder"), "full_roast");
  assert.equal(effectiveVibe("sarcastic", "nicer"), "chill");
});

class FakeAdapter implements ProviderAdapter {
  label = "Fake";
  calls: string[] = [];
  constructor(public id: "groq" | "gemini", private behaviour: Record<string, "ok" | "429" | "500">) {}
  available() { return true; }
  async *stream(m: ModelCapability, _msgs: ChatMessage[], _o: StreamOptions): AsyncIterable<string> {
    this.calls.push(m.id);
    const b = this.behaviour[m.id] ?? "ok";
    if (b === "429") throw new ProviderError(429, 60_000);
    if (b === "500") { yield "partial "; throw new ProviderError(500); }
    yield "hello from " + m.id;
  }
}

const cls = { intent: "chat" as const, needsLongContext: false, confidence: 1, sensitive: false, source: "rules" as const };
const ctx = { system: "You are Mawa AI.", summary: "", turns: [{ role: "user" as const, content: "yo" }] };

async function collect(r: Router) {
  let text = ""; let done: { modelId: string | null } | null = null; const models: string[] = [];
  for await (const e of r.answer(cls, ctx)) {
    if (e.type === "delta") text += e.text;
    if (e.type === "model") models.push(e.modelId);
    if (e.type === "done") done = e;
  }
  return { text, done: done!, models };
}

test("falls back on 429 and cools the model down", async () => {
  const groq = new FakeAdapter("groq", { "groq:gpt-oss-120b": "429" });
  const gem = new FakeAdapter("gemini", {});
  const q = new MemoryQuota();
  const r = new Router(buildModels({}), { groq, gemini: gem, mock: new MockAdapter() }, q);
  const a = await collect(r);
  assert.equal(a.models[0], "groq:gpt-oss-120b");
  assert.equal(a.done.modelId, "gemini:flash-lite");
  assert.match(a.text, /hello from gemini:flash-lite/);
  // Next request skips the cooled-down model entirely.
  const b = await collect(r);
  assert.ok(!b.models.includes("groq:gpt-oss-120b"));
});

test("mid-stream failure continues on the next model with the partial text", async () => {
  const groq = new FakeAdapter("groq", { "groq:gpt-oss-120b": "500" });
  const r = new Router(buildModels({}), { groq, gemini: new FakeAdapter("gemini", {}), mock: new MockAdapter() }, new MemoryQuota());
  const a = await collect(r);
  assert.match(a.text, /^partial hello from gemini/);
});

test("all providers down -> friendly busy text, never 'limit reached'", async () => {
  const all429 = Object.fromEntries(buildModels({}).map((m) => [m.id, "429" as const]));
  const r = new Router(buildModels({}), { groq: new FakeAdapter("groq", all429), gemini: new FakeAdapter("gemini", all429), mock: new MockAdapter() }, new MemoryQuota());
  const a = await collect(r);
  assert.equal(a.text, BUSY_TEXT);
  assert.ok(!/limit/i.test(a.text));
});

test("no keys -> mock provider answers", async () => {
  const unavailable = { id: "groq" as const, label: "x", available: () => false, stream: async function* () { yield ""; } };
  const r = new Router(buildModels({}), { groq: unavailable, mock: new MockAdapter() }, new MemoryQuota());
  const a = await collect(r);
  assert.equal(a.done.modelId, "mock:local");
  assert.ok(a.text.length > 10);
});

test("long history is trimmed oldest-first to fit Groq's 8K TPM", () => {
  const groq = buildModels({}).find((m) => m.id === "groq:gpt-oss-120b")!;
  const turns: ChatMessage[] = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `turn ${i} ` + "x".repeat(800) }));
  const f = fitContext({ system: "sys", summary: "earlier stuff", turns }, groq);
  assert.equal(f.plan, "trimmed");
  assert.ok(f.dropped.length > 0);
  assert.equal(f.messages.at(-1)!.content, turns.at(-1)!.content);
  assert.equal(f.dropped[0]!.content, turns[0]!.content);
});

test("inline <thought> blocks are stripped from streams, even split across chunks", async () => {
  const { createThoughtFilter } = await import("../src/lib/providers/openai-compatible");
  const f = createThoughtFilter();
  const chunks = ["<tho", "ught>secret plan", " more</th", "ought>\nHi ", "mawa <b>x</b>"];
  const out = chunks.map((c) => f.push(c)).join("") + f.flush();
  assert.equal(out, "Hi mawa <b>x</b>");
  const g = createThoughtFilter();
  assert.equal(g.push("a < b and 3<4") + g.flush(), "a < b and 3<4");
});
