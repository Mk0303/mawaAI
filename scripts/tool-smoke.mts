// One tiny real call per tool provider. Prints pass/fail only, never keys.
// Usage: node --conditions=react-server --import tsx scripts/tool-smoke.mts <audio-file>
import { readFileSync } from "node:fs";
import { cloudflareFlux, pollinations } from "../src/lib/tools/image-gen";
import { webSearch } from "../src/lib/tools/search";
import { cloudflareWhisper, groqWhisper } from "../src/lib/tools/stt";

const audioPath = process.argv[2];
const run = async (name: string, f: () => Promise<string>) => {
  const t0 = Date.now();
  try { const out = await f(); console.log(`PASS ${name} ${out} (${Date.now() - t0}ms)`); }
  catch (e) { console.log(`FAIL ${name} ${e instanceof Error ? e.message : "?"}`); }
};
await run("image:cloudflare-flux", async () => { const r = await cloudflareFlux("a tiny cartoon samosa wearing sunglasses"); return `${r.mime} ${r.data.length}B`; });
await run("image:pollinations", async () => { const r = await pollinations("a tiny cartoon samosa wearing sunglasses"); return `${r.mime} ${r.data.length}B`; });
await run("search:tavily", async () => { const r = await webSearch("ISRO latest launch", 3); return `${r.length} results, hosts=${r.map((x) => x.host).join(",")}`; });
if (audioPath) {
  const a = readFileSync(audioPath);
  const mime = audioPath.endsWith(".webm") ? "audio/webm" : audioPath.endsWith(".m4a") ? "audio/mp4" : "audio/wav";
  await run("stt:cloudflare-whisper", async () => JSON.stringify((await cloudflareWhisper(a)).trim().slice(0, 60)));
  await run("stt:groq-whisper", async () => JSON.stringify((await groqWhisper(a, mime)).trim().slice(0, 60)));
}
