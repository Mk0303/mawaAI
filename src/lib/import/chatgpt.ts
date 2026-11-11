import { IMPORT_LIMITS as L, type ParsedConversation, type ParsedMessage } from "./types";

type Node = { parent?: unknown; message?: unknown };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const time = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v * 1000) : null);

/** True if the parsed JSON looks like ChatGPT's conversations.json. */
export function looksLikeChatGPT(data: unknown): boolean {
  return Array.isArray(data) && data.slice(0, 5).some((c) => isObj(c) && isObj(c.mapping));
}

function messageFrom(raw: unknown): ParsedMessage | null {
  if (!isObj(raw)) return null;
  const author = isObj(raw.author) ? raw.author.role : undefined;
  if (author !== "user" && author !== "assistant") return null; // skip system/tool
  const meta = isObj(raw.metadata) ? raw.metadata : {};
  if (meta.is_visually_hidden_from_conversation === true) return null;
  const content = isObj(raw.content) ? raw.content : {};
  const parts = Array.isArray(content.parts) ? content.parts : typeof content.text === "string" ? [content.text] : [];
  const text = parts.filter((p): p is string => typeof p === "string").join("\n").trim().slice(0, L.maxMessageChars);
  if (!text) return null;
  return { role: author, content: text, at: time(raw.create_time) };
}

export function parseChatGPT(data: unknown): { conversations: ParsedConversation[]; skipped: number } {
  if (!Array.isArray(data)) return { conversations: [], skipped: 0 };
  const out: ParsedConversation[] = [];
  let skipped = 0;
  let total = 0;
  for (const c of data.slice(0, L.maxConversations)) {
    if (!isObj(c) || !isObj(c.mapping)) { skipped++; continue; }
    const mapping = c.mapping as Record<string, Node>;
    // Walk the active branch from current_node back to the root.
    let cur = typeof c.current_node === "string" ? c.current_node : undefined;
    if (!cur || !Object.hasOwn(mapping, cur)) {
      const leaves = Object.keys(mapping);
      cur = leaves[leaves.length - 1];
    }
    const chain: ParsedMessage[] = [];
    const seen = new Set<string>();
    while (cur && Object.hasOwn(mapping, cur) && !seen.has(cur) && seen.size < 10_000) {
      seen.add(cur);
      const node = mapping[cur];
      if (!isObj(node)) break;
      const m = messageFrom(node.message);
      if (m) chain.push(m);
      cur = typeof node.parent === "string" ? node.parent : undefined;
    }
    chain.reverse();
    const messages = chain.slice(0, L.maxMessagesPerConversation);
    if (!messages.length) { skipped++; continue; }
    total += messages.length;
    if (total > L.maxTotalMessages) break;
    out.push({
      extId: str(c.conversation_id ?? c.id, 80) || `chatgpt-${out.length}`,
      title: str(c.title, 120).trim() || messages[0]!.content.slice(0, 60),
      createdAt: time(c.create_time),
      messages,
    });
  }
  return { conversations: out, skipped };
}
