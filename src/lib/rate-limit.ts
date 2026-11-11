/**
 * Fixed-window rate limiter behind an interface. SQLite is the default for the
 * single-server box (survives process restarts). Swap in an Upstash
 * implementation of `RateLimiter` later if we move to serverless.
 */
import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export interface RateLimiter {
  hit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number };
}

const KEY_RE = /^[\w.:@-]{1,200}$/;
function normalizeKey(key: string): string {
  if (KEY_RE.test(key)) return key;
  return `h:${createHash("sha256").update(key).digest("hex")}`;
}

export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  hit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    if (this.buckets.size > 10_000) {
      for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
    }
    const k = normalizeKey(key);
    let b = this.buckets.get(k);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs };
      this.buckets.set(k, b);
    }
    b.count++;
    return { ok: b.count <= limit, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_reset ON rate_limits(reset_at);
`;

export class SqliteRateLimiter implements RateLimiter {
  private db: Database.Database;
  private hits = 0;
  constructor(file: string) {
    if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.db.exec(SCHEMA);
    this.stmtGet = this.db.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?");
    this.stmtUpsert = this.db.prepare(
      "INSERT INTO rate_limits (key, count, reset_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET count = excluded.count, reset_at = excluded.reset_at",
    );
    this.stmtClean = this.db.prepare("DELETE FROM rate_limits WHERE reset_at <= ?");
  }
  private stmtGet: Database.Statement;
  private stmtUpsert: Database.Statement;
  private stmtClean: Database.Statement;

  hit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const k = normalizeKey(key);
    return this.db.transaction(() => {
      this.hits++;
      if (this.hits % 100 === 0) this.stmtClean.run(now);
      const row = this.stmtGet.get(k) as { count: number; reset_at: number } | undefined;
      if (!row || row.reset_at <= now) {
        const resetAt = now + windowMs;
        this.stmtUpsert.run(k, 1, resetAt);
        return { ok: 1 <= limit, retryAfterSec: Math.ceil((resetAt - now) / 1000) };
      }
      const count = row.count + 1;
      this.stmtUpsert.run(k, count, row.reset_at);
      return { ok: count <= limit, retryAfterSec: Math.max(1, Math.ceil((row.reset_at - now) / 1000)) };
    })();
  }

  close() {
    this.db.close();
  }
}

function defaultLimiter(): RateLimiter {
  // Unit tests (node:test sets NODE_TEST_CONTEXT) stay in-memory so they
  // never touch data/mawa.db. Production (and explicit opt-in) use SQLite.
  if (process.env.MAWA_RATE_LIMIT === "memory" || process.env.NODE_TEST_CONTEXT) {
    return new MemoryRateLimiter();
  }
  const file = process.env.DATABASE_PATH ?? "data/mawa.db";
  return new SqliteRateLimiter(file);
}

const g = globalThis as unknown as { __mawaRL?: RateLimiter };
export const rateLimiter: RateLimiter = (g.__mawaRL ??= defaultLimiter());

export const LIMITS = {
  chatPerMin: 20,
  apiPerMin: 120,
  loginPerMin: 10,
} as const;
