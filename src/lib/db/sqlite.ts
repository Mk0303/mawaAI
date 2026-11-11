import { DEFAULT_THEME, isThemeId } from "../themes/ids";
import { DEFAULT_SEND_GAMES, parseSendGames } from "../sendgames/games";
import "server-only";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Attachment, MediaKind, MediaRow, MediaStore, Source, UsageKind } from "./store";
import type { ImportedConvRow, ImportedMsgRow, ImportRow, ImportStore, MessageRow, Settings, Store, ThreadRow, UserRow, Vibe, Mood } from "./store";
import { ftsQuery, type MemoryChunk, type MemoryStore } from "../memory";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vibe TEXT NOT NULL DEFAULT 'sarcastic' CHECK (vibe IN ('chill','sarcastic','full_roast')),
  mawa INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', summary_upto INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS threads_user ON threads(user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')), content TEXT NOT NULL,
  model TEXT, intent TEXT, mood TEXT, ms INTEGER, created_at INTEGER NOT NULL, seq INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_thread ON messages(thread_id, seq);
CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('chatgpt','gemini')), created_at INTEGER NOT NULL,
  conv_count INTEGER NOT NULL, msg_count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS imported_conversations (
  id TEXT PRIMARY KEY, import_id TEXT NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, source TEXT NOT NULL,
  ext_id TEXT NOT NULL, title TEXT NOT NULL, created_at INTEGER, message_count INTEGER NOT NULL,
  UNIQUE (user_id, source, ext_id)
);
CREATE INDEX IF NOT EXISTS iconv_user ON imported_conversations(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS imported_messages (
  conv_id TEXT NOT NULL REFERENCES imported_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, seq INTEGER NOT NULL, role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL, at INTEGER, PRIMARY KEY (conv_id, seq)
);
CREATE TABLE IF NOT EXISTS memory_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  import_id TEXT REFERENCES imports(id) ON DELETE CASCADE, source TEXT NOT NULL, ref_id TEXT NOT NULL,
  title TEXT NOT NULL, text TEXT NOT NULL, embedding BLOB
);
CREATE INDEX IF NOT EXISTS mem_user ON memory_chunks(user_id);
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(text, content='memory_chunks', content_rowid='id', tokenize='unicode61');
CREATE TRIGGER IF NOT EXISTS mem_ai AFTER INSERT ON memory_chunks BEGIN
  INSERT INTO memory_fts(rowid, text) VALUES (new.id, new.text);
END;
CREATE TRIGGER IF NOT EXISTS mem_ad AFTER DELETE ON memory_chunks BEGIN
  INSERT INTO memory_fts(memory_fts, rowid, text) VALUES ('delete', old.id, old.text);
END;
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image_gen','photo','pdf')), mime TEXT NOT NULL, name TEXT,
  bytes INTEGER NOT NULL, pages INTEGER, text TEXT, thread_id TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS media_thread ON media(user_id, thread_id);
CREATE TABLE IF NOT EXISTS usage (
  user_id TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, count INTEGER NOT NULL,
  PRIMARY KEY (user_id, day, kind)
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, about TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_reset ON rate_limits(reset_at);
`;

type ThreadDb = { id: string; title: string; summary: string; summary_upto: number; created_at: number; updated_at: number };
type MsgDb = { id: string; thread_id: string; role: "user" | "assistant"; content: string; model: string | null; intent: string | null; mood: string | null; ms: number | null; created_at: number; attachments: string | null; sources: string | null };
type MediaDb = { id: string; kind: MediaKind; mime: string; name: string | null; bytes: number; pages: number | null; text: string | null; thread_id: string | null; created_at: number };
const toMedia = (r: MediaDb): MediaRow => ({ id: r.id, kind: r.kind, mime: r.mime, name: r.name, bytes: r.bytes, pages: r.pages, text: r.text, threadId: r.thread_id, createdAt: r.created_at });
const MIME_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" };
const ID_RE = /^[0-9a-f-]{36}$/;
/** Day key in IST so soft limits reset at Indian midnight. */
const istDay = (now = Date.now()) => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
function parseJsonArr<T>(s: string | null): T[] | undefined {
  if (!s) return undefined;
  try { const v = JSON.parse(s); return Array.isArray(v) ? (v as T[]) : undefined; } catch { return undefined; }
}

const toThread = (r: ThreadDb): ThreadRow => ({ id: r.id, title: r.title, summary: r.summary, summaryUpto: r.summary_upto, createdAt: r.created_at, updatedAt: r.updated_at });
const toMsg = (r: MsgDb): MessageRow => ({ id: r.id, threadId: r.thread_id, role: r.role, content: r.content, model: r.model, intent: r.intent, mood: (r.mood as Mood | null), ms: r.ms, createdAt: r.created_at, attachments: parseJsonArr<Attachment>(r.attachments), sources: parseJsonArr<Source>(r.sources) });

type IConvDb = { id: string; import_id: string; source: "chatgpt" | "gemini"; title: string; created_at: number | null; message_count: number };
const toIConv = (r: IConvDb): ImportedConvRow => ({ id: r.id, importId: r.import_id, source: r.source, title: r.title, createdAt: r.created_at, messageCount: r.message_count });

export class SqliteStore implements Store, ImportStore, MemoryStore, MediaStore {
  private db: Database.Database;
  private mediaDir: string;
  constructor(file: string, mediaDir?: string) {
    if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.mediaDir = path.resolve(mediaDir ?? (file === ":memory:" ? fs.mkdtempSync(path.join(os.tmpdir(), "mawa-media-")) : path.join(path.dirname(path.resolve(file)), "media")));
    this.db = new Database(file);
    this.db.exec(SCHEMA);
    // Additive migrations (M2).
    const cols = new Set((this.db.prepare("PRAGMA table_info(messages)").all() as { name: string }[]).map((c) => c.name));
    if (!cols.has("attachments")) this.db.exec("ALTER TABLE messages ADD COLUMN attachments TEXT");
    if (!cols.has("sources")) this.db.exec("ALTER TABLE messages ADD COLUMN sources TEXT");
    const scols = new Set((this.db.prepare("PRAGMA table_info(settings)").all() as { name: string }[]).map((c) => c.name));
    if (!scols.has("theme")) this.db.exec("ALTER TABLE settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'savage'");
    if (!scols.has("send_games")) this.db.exec("ALTER TABLE settings ADD COLUMN send_games TEXT");
  }

  upsertUser(u: { email: string; name: string | null }): UserRow {
    const email = u.email.toLowerCase();
    const existing = this.db.prepare("SELECT id, email, name FROM users WHERE email = ?").get(email) as UserRow | undefined;
    if (existing) {
      if (u.name && u.name !== existing.name) this.db.prepare("UPDATE users SET name = ? WHERE id = ?").run(u.name, existing.id);
      return { ...existing, name: u.name ?? existing.name };
    }
    const id = randomUUID();
    this.db.transaction(() => {
      this.db.prepare("INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)").run(id, email, u.name, Date.now());
      this.db.prepare("INSERT INTO settings (user_id) VALUES (?)").run(id);
    })();
    return { id, email, name: u.name };
  }

  getSettings(userId: string): Settings {
    const r = this.db.prepare("SELECT vibe, mawa, theme, send_games FROM settings WHERE user_id = ?").get(userId) as { vibe: Vibe; mawa: number; theme: string; send_games: string | null } | undefined;
    const theme = isThemeId(r?.theme) ? r.theme : DEFAULT_THEME;
    const sendGames = r?.send_games ? parseSendGames(r.send_games) : { ...DEFAULT_SEND_GAMES };
    return r ? { vibe: r.vibe, mawa: r.mawa === 1, theme, sendGames } : { vibe: "sarcastic", mawa: true, theme, sendGames };
  }

  saveSettings(userId: string, s: Settings): Settings {
    this.db.prepare(
      "INSERT INTO settings (user_id, vibe, mawa, theme, send_games) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET vibe = excluded.vibe, mawa = excluded.mawa, theme = excluded.theme, send_games = excluded.send_games",
    ).run(userId, s.vibe, s.mawa ? 1 : 0, isThemeId(s.theme) ? s.theme : DEFAULT_THEME, JSON.stringify(parseSendGames(s.sendGames ?? DEFAULT_SEND_GAMES)));
    return s;
  }

  createThread(userId: string, title: string): ThreadRow {
    const now = Date.now();
    const id = randomUUID();
    this.db.prepare("INSERT INTO threads (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, userId, title, now, now);
    return { id, title, summary: "", summaryUpto: 0, createdAt: now, updatedAt: now };
  }

  getThread(userId: string, threadId: string): ThreadRow | null {
    const r = this.db.prepare("SELECT * FROM threads WHERE id = ? AND user_id = ?").get(threadId, userId) as ThreadDb | undefined;
    return r ? toThread(r) : null;
  }

  listThreads(userId: string, limit: number): ThreadRow[] {
    return (this.db.prepare("SELECT * FROM threads WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?").all(userId, limit) as ThreadDb[]).map(toThread);
  }

  deleteThread(userId: string, threadId: string): boolean {
    return this.db.prepare("DELETE FROM threads WHERE id = ? AND user_id = ?").run(threadId, userId).changes > 0;
  }

  listMessages(userId: string, threadId: string, limit: number): MessageRow[] {
    const rows = this.db.prepare(
      "SELECT * FROM (SELECT * FROM messages WHERE thread_id = ? AND user_id = ? ORDER BY seq DESC LIMIT ?) ORDER BY seq ASC",
    ).all(threadId, userId, limit) as MsgDb[];
    return rows.map(toMsg);
  }

  addMessage(userId: string, m: Omit<MessageRow, "id" | "createdAt">): MessageRow {
    const id = randomUUID();
    const now = Date.now();
    this.db.transaction(() => {
      const t = this.db.prepare("SELECT id FROM threads WHERE id = ? AND user_id = ?").get(m.threadId, userId);
      if (!t) throw new Error("thread_not_found");
      const seq = (this.db.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS s FROM messages WHERE thread_id = ?").get(m.threadId) as { s: number }).s;
      this.db.prepare(
        "INSERT INTO messages (id, thread_id, user_id, role, content, model, intent, mood, ms, created_at, seq, attachments, sources) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(id, m.threadId, userId, m.role, m.content, m.model, m.intent, m.mood, m.ms, now, seq,
        m.attachments?.length ? JSON.stringify(m.attachments) : null, m.sources?.length ? JSON.stringify(m.sources) : null);
      this.db.prepare("UPDATE threads SET updated_at = ? WHERE id = ? AND user_id = ?").run(now, m.threadId, userId);
    })();
    return { ...m, id, createdAt: now };
  }

  deleteLastAssistant(userId: string, threadId: string): void {
    this.db.prepare(
      `DELETE FROM messages WHERE id = (SELECT id FROM messages WHERE thread_id = ? AND user_id = ? ORDER BY seq DESC LIMIT 1) AND role = 'assistant'`,
    ).run(threadId, userId);
  }

  saveSummary(userId: string, threadId: string, summary: string, upto: number): void {
    this.db.prepare("UPDATE threads SET summary = ?, summary_upto = ? WHERE id = ? AND user_id = ?").run(summary, upto, threadId, userId);
  }

  // ---- imports (every query scoped by user_id) ----
  saveImport(userId: string, source: "chatgpt" | "gemini", convs: { extId: string; title: string; createdAt: number | null; messages: ImportedMsgRow[] }[]) {
    const importId = randomUUID();
    const convIds: string[] = [];
    let msgCount = 0;
    let duplicates = 0;
    this.db.transaction(() => {
      this.db.prepare("INSERT INTO imports (id, user_id, source, created_at, conv_count, msg_count) VALUES (?, ?, ?, ?, 0, 0)").run(importId, userId, source, Date.now());
      const insConv = this.db.prepare("INSERT OR IGNORE INTO imported_conversations (id, import_id, user_id, source, ext_id, title, created_at, message_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      const insMsg = this.db.prepare("INSERT INTO imported_messages (conv_id, user_id, seq, role, content, at) VALUES (?, ?, ?, ?, ?, ?)");
      for (const c of convs) {
        const id = randomUUID();
        // Re-importing the same export skips chats already imported.
        if (insConv.run(id, importId, userId, source, c.extId, c.title, c.createdAt, c.messages.length).changes === 0) { duplicates++; continue; }
        c.messages.forEach((m, i) => insMsg.run(id, userId, i, m.role, m.content, m.at));
        convIds.push(id);
        msgCount += c.messages.length;
      }
      this.db.prepare("UPDATE imports SET conv_count = ?, msg_count = ? WHERE id = ? AND user_id = ?").run(convIds.length, msgCount, importId, userId);
    })();
    return { importId, convIds, convCount: convIds.length, msgCount, duplicates };
  }

  listImports(userId: string): ImportRow[] {
    return (this.db.prepare("SELECT id, source, created_at, conv_count, msg_count FROM imports WHERE user_id = ? ORDER BY created_at DESC").all(userId) as
      { id: string; source: "chatgpt" | "gemini"; created_at: number; conv_count: number; msg_count: number }[])
      .map((r) => ({ id: r.id, source: r.source, createdAt: r.created_at, convCount: r.conv_count, msgCount: r.msg_count }));
  }

  listImportedConversations(userId: string, limit: number): ImportedConvRow[] {
    return (this.db.prepare("SELECT * FROM imported_conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit) as IConvDb[]).map(toIConv);
  }

  getImportedConversation(userId: string, convId: string) {
    const c = this.db.prepare("SELECT * FROM imported_conversations WHERE id = ? AND user_id = ?").get(convId, userId) as IConvDb | undefined;
    if (!c) return null;
    const messages = this.db.prepare("SELECT role, content, at FROM imported_messages WHERE conv_id = ? AND user_id = ? ORDER BY seq LIMIT 2000").all(convId, userId) as ImportedMsgRow[];
    return { conv: toIConv(c), messages };
  }

  sampleUserMessages(userId: string, maxChars: number): string[] {
    const rows = this.db.prepare(
      "SELECT substr(content, 1, 240) AS c FROM imported_messages WHERE user_id = ? AND role = 'user' ORDER BY random() LIMIT 400",
    ).all(userId) as { c: string }[];
    const out: string[] = [];
    let n = 0;
    for (const r of rows) { if (n + r.c.length > maxChars) break; out.push(r.c); n += r.c.length; }
    return out;
  }

  deleteImport(userId: string, importId: string): boolean {
    return this.db.prepare("DELETE FROM imports WHERE id = ? AND user_id = ?").run(importId, userId).changes > 0;
  }

  deleteAllImports(userId: string): number {
    let n = 0;
    this.db.transaction(() => {
      n = this.db.prepare("DELETE FROM imports WHERE user_id = ?").run(userId).changes;
      this.db.prepare("DELETE FROM memory_chunks WHERE user_id = ? AND source IN ('chatgpt','gemini')").run(userId);
      this.db.prepare("DELETE FROM profiles WHERE user_id = ?").run(userId);
    })();
    return n;
  }

  // ---- memory ----
  addChunks(userId: string, importId: string | null, chunks: MemoryChunk[]): number {
    const ins = this.db.prepare("INSERT INTO memory_chunks (user_id, import_id, source, ref_id, title, text) VALUES (?, ?, ?, ?, ?, ?)");
    this.db.transaction(() => { for (const c of chunks) ins.run(userId, importId, c.source, c.refId, c.title.slice(0, 200), c.text.slice(0, 4000)); })();
    return chunks.length;
  }

  search(userId: string, query: string, k: number): string[] {
    const q = ftsQuery(query);
    if (!q) return [];
    try {
      const rows = this.db.prepare(
        "SELECT m.text AS text FROM memory_fts f JOIN memory_chunks m ON m.id = f.rowid WHERE memory_fts MATCH ? AND m.user_id = ? ORDER BY bm25(memory_fts) LIMIT ?",
      ).all(q, userId, Math.min(k, 10)) as { text: string }[];
      return rows.map((r) => r.text.slice(0, 700));
    } catch {
      return []; // malformed query: no memories rather than an error
    }
  }

  searchIn(userId: string, refIds: string[], query: string, k: number): string[] {
    const q = ftsQuery(query);
    const ids = refIds.filter((id) => ID_RE.test(id)).slice(0, 10);
    if (!ids.length) return [];
    const marks = ids.map(() => "?").join(",");
    try {
      if (!q) return (this.db.prepare(`SELECT text FROM memory_chunks WHERE user_id = ? AND ref_id IN (${marks}) ORDER BY id LIMIT ?`).all(userId, ...ids, k) as { text: string }[]).map((r) => r.text);
      return (this.db.prepare(
        `SELECT m.text AS text FROM memory_fts f JOIN memory_chunks m ON m.id = f.rowid WHERE memory_fts MATCH ? AND m.user_id = ? AND m.ref_id IN (${marks}) ORDER BY bm25(memory_fts) LIMIT ?`,
      ).all(q, userId, ...ids, Math.min(k, 20)) as { text: string }[]).map((r) => r.text);
    } catch {
      return [];
    }
  }

  getProfile(userId: string): string | null {
    const r = this.db.prepare("SELECT about FROM profiles WHERE user_id = ?").get(userId) as { about: string } | undefined;
    return r?.about ?? null;
  }

  setProfile(userId: string, about: string): void {
    this.db.prepare("INSERT INTO profiles (user_id, about, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET about = excluded.about, updated_at = excluded.updated_at")
      .run(userId, about.slice(0, 1500), Date.now());
  }

  // ---- media (files live outside the web root; names are server-generated UUIDs) ----
  private fileFor(userId: string, id: string, mime: string): string {
    if (!ID_RE.test(userId) || !ID_RE.test(id)) throw new Error("bad_id");
    const ext = MIME_EXT[mime];
    if (!ext) throw new Error("bad_mime");
    const p = path.join(this.mediaDir, userId, `${id}.${ext}`);
    if (!p.startsWith(this.mediaDir + path.sep)) throw new Error("bad_path");
    return p;
  }

  saveMedia(userId: string, m: { kind: MediaKind; mime: string; name: string | null; data: Buffer; pages?: number | null; text?: string | null }): MediaRow {
    const id = randomUUID();
    const file = this.fileFor(userId, id, m.mime);
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, m.data, { mode: 0o600 });
    const now = Date.now();
    const name = m.name ? m.name.replace(/[^\p{L}\p{N} ._()-]/gu, "_").slice(0, 120) : null;
    this.db.prepare("INSERT INTO media (id, user_id, kind, mime, name, bytes, pages, text, thread_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)")
      .run(id, userId, m.kind, m.mime, name, m.data.length, m.pages ?? null, m.text ?? null, now);
    return { id, kind: m.kind, mime: m.mime, name, bytes: m.data.length, pages: m.pages ?? null, text: m.text ?? null, threadId: null, createdAt: now };
  }

  getMedia(userId: string, id: string): MediaRow | null {
    const r = this.db.prepare("SELECT * FROM media WHERE id = ? AND user_id = ?").get(id, userId) as MediaDb | undefined;
    return r ? toMedia(r) : null;
  }

  readMediaBytes(userId: string, id: string) {
    const row = this.getMedia(userId, id);
    if (!row) return null;
    try { return { row, data: fs.readFileSync(this.fileFor(userId, id, row.mime)) }; } catch { return null; }
  }

  linkMediaToThread(userId: string, ids: string[], threadId: string): void {
    const st = this.db.prepare("UPDATE media SET thread_id = ? WHERE id = ? AND user_id = ? AND (thread_id IS NULL OR thread_id = ?)");
    this.db.transaction(() => { for (const id of ids) st.run(threadId, id, userId, threadId); })();
  }

  threadDocs(userId: string, threadId: string): MediaRow[] {
    return (this.db.prepare("SELECT * FROM media WHERE user_id = ? AND thread_id = ? AND kind = 'pdf' ORDER BY created_at LIMIT 5").all(userId, threadId) as MediaDb[]).map(toMedia);
  }

  bumpUsage(userId: string, kind: UsageKind, by = 1): number {
    const day = istDay();
    this.db.prepare("INSERT INTO usage (user_id, day, kind, count) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, day, kind) DO UPDATE SET count = count + excluded.count").run(userId, day, kind, by);
    return this.getUsage(userId, kind);
  }

  getUsage(userId: string, kind: UsageKind): number {
    const r = this.db.prepare("SELECT count FROM usage WHERE user_id = ? AND day = ? AND kind = ?").get(userId, istDay(), kind) as { count: number } | undefined;
    return r?.count ?? 0;
  }
}
