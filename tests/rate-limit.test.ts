import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { MemoryRateLimiter, SqliteRateLimiter } from "../src/lib/rate-limit";

test("memory limiter allows up to the limit, then rejects", () => {
  const rl = new MemoryRateLimiter();
  assert.equal(rl.hit("chat:u1", 2, 60_000).ok, true);
  assert.equal(rl.hit("chat:u1", 2, 60_000).ok, true);
  const denied = rl.hit("chat:u1", 2, 60_000);
  assert.equal(denied.ok, false);
  assert.ok(denied.retryAfterSec > 0);
  assert.equal(rl.hit("chat:u2", 2, 60_000).ok, true);
});

test("sqlite limiter persists across a reopen of the same file", () => {
  const dir = mkdtempSync(join(tmpdir(), "mawa-rl-"));
  const file = join(dir, "rl.db");
  try {
    const a = new SqliteRateLimiter(file);
    assert.equal(a.hit("chat:u1", 2, 60_000).ok, true);
    a.close();
    const b = new SqliteRateLimiter(file);
    assert.equal(b.hit("chat:u1", 2, 60_000).ok, true);
    const denied = b.hit("chat:u1", 2, 60_000);
    assert.equal(denied.ok, false);
    assert.ok(denied.retryAfterSec > 0);
    b.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sqlite limiter starts a new window after it expires", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mawa-rl-"));
  const file = join(dir, "rl.db");
  try {
    const rl = new SqliteRateLimiter(file);
    assert.equal(rl.hit("login:1.2.3.4", 1, 40).ok, true);
    assert.equal(rl.hit("login:1.2.3.4", 1, 40).ok, false);
    await sleep(50);
    assert.equal(rl.hit("login:1.2.3.4", 1, 40).ok, true);
    rl.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
