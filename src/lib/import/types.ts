export type ImportSource = "chatgpt" | "gemini";

export interface ParsedMessage { role: "user" | "assistant"; content: string; at: number | null }
export interface ParsedConversation { extId: string; title: string; createdAt: number | null; messages: ParsedMessage[] }
export interface ParsedExport { source: ImportSource; conversations: ParsedConversation[]; skipped: number }

/** Friendly, jargon-free errors shown to the user as-is. */
export class ImportError extends Error {
  constructor(public code: string, public friendly: string) { super(code); }
}

export const IMPORT_LIMITS = {
  maxUploadBytes: 200 * 1024 * 1024,     // the zip as uploaded
  maxEntryBytes: 120 * 1024 * 1024,      // one extracted file
  maxTotalExtractBytes: 160 * 1024 * 1024,
  maxZipEntries: 20_000,
  maxRatio: 150,                         // zip-bomb guard: uncompressed / compressed
  maxConversations: 5_000,
  maxMessagesPerConversation: 2_000,
  maxMessageChars: 20_000,
  maxTotalMessages: 150_000,
} as const;
