import type { SendGameSettings } from "../sendgames/games";
import type { ThemeId } from "../themes/ids";
/**
 * Persistence interface. SQLite implements it for M1; a Supabase/pgvector
 * implementation can replace it later without touching routes or the router.
 * Every method that reads or writes user data takes the owner's userId and
 * scopes the query by it (A01: no IDOR).
 */
export type Vibe = "chill" | "sarcastic" | "full_roast";
export type Role = "user" | "assistant";
export type Mood = "chill" | "smug" | "roast" | "flex" | "care";

export interface UserRow { id: string; email: string; name: string | null }
export interface Settings { vibe: Vibe; mawa: boolean; theme: ThemeId; sendGames: SendGameSettings }
export interface ThreadRow { id: string; title: string; summary: string; summaryUpto: number; createdAt: number; updatedAt: number }
export interface Attachment { id: string; kind: MediaKind; name: string | null; pages?: number | null }
export interface Source { title: string; url: string; host: string }
export interface MessageRow {
  id: string; threadId: string; role: Role; content: string;
  model: string | null; intent: string | null; mood: Mood | null; ms: number | null; createdAt: number;
  attachments?: Attachment[]; sources?: Source[];
}

export type MediaKind = "image_gen" | "photo" | "pdf";
export interface MediaRow {
  id: string; kind: MediaKind; mime: string; name: string | null; bytes: number;
  pages: number | null; text: string | null; threadId: string | null; createdAt: number;
}
export type UsageKind = "chat" | "image" | "search" | "voice" | "upload";

export interface MediaStore {
  saveMedia(userId: string, m: { kind: MediaKind; mime: string; name: string | null; data: Buffer; pages?: number | null; text?: string | null }): MediaRow;
  getMedia(userId: string, id: string): MediaRow | null;
  readMediaBytes(userId: string, id: string): { row: MediaRow; data: Buffer } | null;
  linkMediaToThread(userId: string, ids: string[], threadId: string): void;
  threadDocs(userId: string, threadId: string): MediaRow[];
  /** Increments and returns the new count for today (IST day). */
  bumpUsage(userId: string, kind: UsageKind, by?: number): number;
  getUsage(userId: string, kind: UsageKind): number;
}

export interface Store {
  upsertUser(u: { email: string; name: string | null }): UserRow;
  getSettings(userId: string): Settings;
  saveSettings(userId: string, s: Settings): Settings;
  createThread(userId: string, title: string): ThreadRow;
  getThread(userId: string, threadId: string): ThreadRow | null;
  listThreads(userId: string, limit: number): ThreadRow[];
  deleteThread(userId: string, threadId: string): boolean;
  listMessages(userId: string, threadId: string, limit: number): MessageRow[];
  addMessage(userId: string, m: Omit<MessageRow, "id" | "createdAt">): MessageRow;
  deleteLastAssistant(userId: string, threadId: string): void;
  saveSummary(userId: string, threadId: string, summary: string, upto: number): void;
}

export interface ImportRow { id: string; source: "chatgpt" | "gemini"; createdAt: number; convCount: number; msgCount: number }
export interface ImportedConvRow { id: string; importId: string; source: "chatgpt" | "gemini"; title: string; createdAt: number | null; messageCount: number }
export interface ImportedMsgRow { role: Role; content: string; at: number | null }

export interface ImportStore {
  saveImport(userId: string, source: "chatgpt" | "gemini", convs: { extId: string; title: string; createdAt: number | null; messages: ImportedMsgRow[] }[]):
    { importId: string; convIds: string[]; convCount: number; msgCount: number; duplicates: number };
  listImports(userId: string): ImportRow[];
  listImportedConversations(userId: string, limit: number): ImportedConvRow[];
  getImportedConversation(userId: string, convId: string): { conv: ImportedConvRow; messages: ImportedMsgRow[] } | null;
  sampleUserMessages(userId: string, maxChars: number): string[];
  deleteImport(userId: string, importId: string): boolean;
  deleteAllImports(userId: string): number;
}
