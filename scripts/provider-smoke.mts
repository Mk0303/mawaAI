// One tiny real request per provider. Prints pass/fail only, never keys.
import { OpenAICompatibleAdapter } from "../src/lib/providers/openai-compatible";
import { buildModels } from "../src/lib/router/registry";
import { ProviderError } from "../src/lib/router/types";

const targets = (process.argv[2] ?? "groq:gpt-oss-20b,gemini:flash-lite").split(",");
const models = buildModels();
for (const id of targets) {
  const m = models.find((x) => x.id === id)!;
  const a = new OpenAICompatibleAdapter(m.providerId as never);
  if (!a.available()) { console.log(`SKIP ${id}: key not set`); continue; }
  const t0 = Date.now();
  try {
    let out = "";
    for await (const c of a.stream(m, [{ role: "user", content: "Reply with exactly: pong" }], { timeoutMs: 20_000, maxTokens: 200 })) out += c;
    console.log(`${out.trim() ? "PASS" : "FAIL(empty)"} ${id} (${m.model}) ${Date.now() - t0}ms reply=${JSON.stringify(out.trim().slice(0, 40))}`);
  } catch (e) {
    console.log(`FAIL ${id} (${m.model}) status=${e instanceof ProviderError ? e.status : "?"} ${e instanceof Error ? e.message : ""}`);
  }
}
