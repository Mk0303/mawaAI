import "server-only";
import { getEnv } from "../env";
import { boundedFetch, ToolError } from "./fetch";
import type { Source } from "../db/store";

export interface SearchResult extends Source { snippet: string }

const cache = new Map<string, { at: number; results: SearchResult[] }>();
const TTL = 60 * 60_000;

/** Only http(s) links with a real host make it to the UI (no javascript: etc). */
export function safeSource(url: unknown, title: unknown): Source | null {
  if (typeof url !== "string" || url.length > 2000) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return { url: u.toString(), host: u.hostname.replace(/^www\./, ""), title: (typeof title === "string" ? title : u.hostname).replace(/\s+/g, " ").slice(0, 140) };
  } catch {
    return null;
  }
}

export function searchAvailable() { return !!getEnv().tavilyKey; }

export async function webSearch(query: string, max = 5): Promise<SearchResult[]> {
  const key = getEnv().tavilyKey;
  if (!key) throw new ToolError("not_configured", 401);
  const q = query.replace(/\s+/g, " ").trim().slice(0, 380);
  const hit = cache.get(q.toLowerCase());
  if (hit && Date.now() - hit.at < TTL) return hit.results;
  const r = await boundedFetch("https://api.tavily.com/search", {
    method: "POST", timeoutMs: 15_000, maxBytes: 1024 * 1024,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ query: q, search_depth: "basic", max_results: Math.min(max, 8), include_answer: false }),
  });
  if (r.status !== 200) throw new ToolError("http_" + r.status, r.status);
  let raw: unknown;
  try { raw = JSON.parse(r.body.toString("utf8")); } catch { throw new ToolError("bad_response", 502); }
  const arr = (raw as { results?: unknown }).results;
  const results: SearchResult[] = [];
  if (Array.isArray(arr)) for (const it of arr) {
    const o = it as Record<string, unknown>;
    const s = safeSource(o.url, o.title);
    if (s) results.push({ ...s, snippet: typeof o.content === "string" ? o.content.replace(/\s+/g, " ").slice(0, 700) : "" });
  }
  if (cache.size > 500) cache.clear();
  cache.set(q.toLowerCase(), { at: Date.now(), results });
  return results;
}
