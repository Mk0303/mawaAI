/**
 * Long-term memory interface. M1: SQLite FTS5 keyword search (bm25).
 * Later: Supabase pgvector with embeddings; `embedding` stays optional so
 * the same chunks can be backfilled.
 */
export interface MemoryChunk { source: "chatgpt" | "gemini" | "chat" | "doc"; refId: string; title: string; text: string; embedding?: number[] }

export interface MemoryStore {
  addChunks(userId: string, importId: string | null, chunks: MemoryChunk[]): number;
  search(userId: string, query: string, k: number): string[];
  /** Search only within the given documents (ref ids), e.g. a thread's PDFs. */
  searchIn(userId: string, refIds: string[], query: string, k: number): string[];
  getProfile(userId: string): string | null;
  setProfile(userId: string, about: string): void;
}

/** Split a conversation into ~1,200-char chunks, each tagged with its title. */
export function chunkConversation(title: string, msgs: { role: string; content: string }[], size = 1200): string[] {
  const chunks: string[] = [];
  let cur = "";
  for (const m of msgs) {
    const line = `${m.role === "user" ? "User" : "AI"}: ${m.content.replace(/\s+/g, " ")}`;
    if (cur && cur.length + line.length > size) { chunks.push(`[${title}] ${cur}`); cur = ""; }
    cur += (cur ? "\n" : "") + line.slice(0, size * 2);
  }
  if (cur) chunks.push(`[${title}] ${cur}`);
  return chunks;
}

/** Build a safe FTS5 query: alphanumeric terms only, each quoted, OR-joined. */
export function ftsQuery(text: string, maxTerms = 12): string | null {
  const STOP = new Set(["the", "and", "for", "you", "your", "with", "that", "this", "what", "how", "can", "are", "was", "have", "about", "from", "please", "mawa", "into", "just", "like"]);
  const terms = [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,30}/gu) ?? []).filter((t) => !STOP.has(t)))].slice(0, maxTerms);
  return terms.length ? terms.map((t) => `"${t}"`).join(" OR ") : null;
}

/** Split plain text into ~size-char chunks on paragraph boundaries. */
export function chunkText(text: string, size = 1500): string[] {
  const paras = text.split(/\n{2,}/);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    for (let i = 0; i < p.length; i += size) {
      const piece = p.slice(i, i + size);
      if (cur && cur.length + piece.length > size) { out.push(cur); cur = ""; }
      cur += (cur ? "\n\n" : "") + piece;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}
