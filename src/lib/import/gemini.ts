import { parse as parseHtml } from "node-html-parser";
import { IMPORT_LIMITS as L, type ParsedConversation, type ParsedMessage } from "./types";

/**
 * Google Takeout "My Activity > Gemini Apps". Activity is a flat list of
 * prompt/response pairs (not threads), so we group them by day.
 */
interface Pair { prompt: string; response: string; at: number | null }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const PROMPT_PREFIX = /^(Prompted|You said|Asked)\s*:?\s*/i;

function htmlToText(html: string): string {
  const root = parseHtml(html.slice(0, 200_000), { blockTextElements: { script: false, style: false, pre: true } });
  return root.structuredText.replace(/\n{3,}/g, "\n\n").trim();
}

export function looksLikeGeminiJson(data: unknown): boolean {
  return Array.isArray(data) && data.slice(0, 10).some((e) =>
    isObj(e) && (e.header === "Gemini Apps" || (Array.isArray(e.products) && e.products.includes("Gemini Apps")) || (typeof e.title === "string" && PROMPT_PREFIX.test(e.title) && "time" in e)));
}

export function looksLikeGeminiHtml(html: string): boolean {
  return /outer-cell/.test(html) && /(Gemini Apps|Bard)/.test(html);
}

export function pairsFromJson(data: unknown): Pair[] {
  if (!Array.isArray(data)) return [];
  const pairs: Pair[] = [];
  for (const e of data) {
    if (!isObj(e) || typeof e.title !== "string" || !PROMPT_PREFIX.test(e.title)) continue;
    const prompt = e.title.replace(PROMPT_PREFIX, "").trim().slice(0, L.maxMessageChars);
    const items = Array.isArray(e.safeHtmlItem) ? e.safeHtmlItem : [];
    const html = items.map((i) => (isObj(i) && typeof i.html === "string" ? i.html : "")).join("\n");
    const at = typeof e.time === "string" ? Date.parse(e.time) : NaN;
    pairs.push({ prompt, response: htmlToText(html).slice(0, L.maxMessageChars), at: Number.isFinite(at) ? at : null });
    if (pairs.length >= L.maxTotalMessages / 2) break;
  }
  return pairs;
}

// e.g. "Nov 10, 2026, 9:41:07 PM IST" or "10 Nov 2026, 21:41:07 IST"
const DATE_LINE = /^([A-Z][a-z]{2} \d{1,2}, \d{4}|\d{1,2} [A-Z][a-z]{2} \d{4}),? \d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?\s*[A-Z]{2,5}$/;

export function pairsFromHtml(html: string): Pair[] {
  const root = parseHtml(html, { blockTextElements: { script: false, style: false } });
  const pairs: Pair[] = [];
  for (const cell of root.querySelectorAll(".outer-cell")) {
    const header = cell.querySelector(".header-cell")?.text ?? "";
    if (header && !/Gemini|Bard/i.test(header)) continue;
    const content = cell.querySelector(".content-cell");
    if (!content) continue;
    const lines = content.structuredText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length || !PROMPT_PREFIX.test(lines[0]!)) continue;
    const di = lines.findIndex((l) => DATE_LINE.test(l.replace(/\u202f/g, " ")));
    const promptLines = di > 0 ? lines.slice(0, di) : [lines[0]!];
    const respLines = di > 0 ? lines.slice(di + 1) : lines.slice(1);
    const at = di > 0 ? Date.parse(lines[di]!.replace(/\u202f/g, " ").replace(/\s+[A-Z]{2,5}$/, "")) : NaN;
    pairs.push({
      prompt: promptLines.join("\n").replace(PROMPT_PREFIX, "").trim().slice(0, L.maxMessageChars),
      response: respLines.join("\n").trim().slice(0, L.maxMessageChars),
      at: Number.isFinite(at) ? at : null,
    });
    if (pairs.length >= L.maxTotalMessages / 2) break;
  }
  return pairs;
}

export function groupGeminiPairs(pairs: Pair[]): ParsedConversation[] {
  const byDay = new Map<string, Pair[]>();
  for (const p of pairs) {
    if (!p.prompt) continue;
    const day = p.at ? new Date(p.at).toISOString().slice(0, 10) : "undated";
    (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(p);
  }
  const convs: ParsedConversation[] = [];
  for (const [day, ps] of byDay) {
    ps.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    const messages: ParsedMessage[] = [];
    for (const p of ps) {
      messages.push({ role: "user", content: p.prompt, at: p.at });
      if (p.response) messages.push({ role: "assistant", content: p.response, at: p.at });
    }
    const first = ps[0]!.prompt.replace(/\s+/g, " ");
    convs.push({
      extId: `gemini-${day}`,
      title: (day === "undated" ? "Gemini chats" : `Gemini · ${day}`) + ` · ${first.slice(0, 50)}`,
      createdAt: ps[0]!.at,
      messages: messages.slice(0, L.maxMessagesPerConversation),
    });
    if (convs.length >= L.maxConversations) break;
  }
  return convs.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}
