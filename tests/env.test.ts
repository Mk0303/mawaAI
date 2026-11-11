import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigError, getEnv, resetEnvCacheForTests, scrubForbiddenEnv } from "../src/lib/env";

const KEYS = [
  "NODE_ENV", "AUTH_SECRET", "AUTH_URL", "AUTH_TRUST_HOST",
  "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "ALLOWED_EMAILS", "DEV_LOGIN",
] as const;

const procEnv = process.env as Record<string, string | undefined>;
function snapshot() {
  const prev: Record<string, string | undefined> = {};
  for (const k of KEYS) prev[k] = procEnv[k];
  return prev;
}
function restore(prev: Record<string, string | undefined>) {
  for (const k of KEYS) {
    if (prev[k] === undefined) delete procEnv[k];
    else procEnv[k] = prev[k];
  }
  resetEnvCacheForTests();
}
function set(k: string, v: string | undefined) {
  if (v === undefined) delete procEnv[k];
  else procEnv[k] = v;
}

test("dev login is forced off in production, even if DEV_LOGIN=true", () => {
  const prev = snapshot();
  try {
    procEnv.NODE_ENV = "production";
    process.env.AUTH_SECRET = "s".repeat(40);
    process.env.DEV_LOGIN = "true";
    set("AUTH_GOOGLE_ID", undefined);
    set("AUTH_GOOGLE_SECRET", undefined);
    set("ALLOWED_EMAILS", undefined);
    set("AUTH_URL", undefined);
    resetEnvCacheForTests();
    const env = getEnv();
    assert.equal(env.isProd, true);
    assert.equal(env.devLogin, false);
    assert.equal(env.google, undefined);
    assert.equal(env.trustHost, true);
  } finally {
    restore(prev);
  }
});

test("production refuses to start without AUTH_SECRET", () => {
  const prev = snapshot();
  try {
    procEnv.NODE_ENV = "production";
    set("AUTH_SECRET", undefined);
    set("AUTH_GOOGLE_ID", undefined);
    set("AUTH_GOOGLE_SECRET", undefined);
    resetEnvCacheForTests();
    assert.throws(() => getEnv(), ConfigError);
  } finally {
    restore(prev);
  }
});

test("production with Google requires an email allowlist", () => {
  const prev = snapshot();
  try {
    procEnv.NODE_ENV = "production";
    process.env.AUTH_SECRET = "s".repeat(40);
    process.env.AUTH_GOOGLE_ID = "1234567890-abcdef.apps.googleusercontent.com";
    process.env.AUTH_GOOGLE_SECRET = "g".repeat(16);
    set("ALLOWED_EMAILS", undefined);
    resetEnvCacheForTests();
    assert.throws(() => getEnv(), (e: unknown) => e instanceof ConfigError && /ALLOWED_EMAILS/.test((e as Error).message));
  } finally {
    restore(prev);
  }
});

test("production AUTH_URL must be https", () => {
  const prev = snapshot();
  try {
    procEnv.NODE_ENV = "production";
    process.env.AUTH_SECRET = "s".repeat(40);
    process.env.AUTH_URL = "http://example.com";
    set("AUTH_GOOGLE_ID", undefined);
    set("AUTH_GOOGLE_SECRET", undefined);
    resetEnvCacheForTests();
    assert.throws(() => getEnv(), (e: unknown) => e instanceof ConfigError && /AUTH_URL/.test((e as Error).message));
  } finally {
    restore(prev);
  }
});

test("scrubForbiddenEnv deletes OPENAI_API_KEY without reading it into app config", () => {
  const had = process.env.OPENAI_API_KEY;
  try {
    process.env.OPENAI_API_KEY = "should-never-be-used";
    scrubForbiddenEnv();
    assert.equal(process.env.OPENAI_API_KEY, undefined);
  } finally {
    if (had === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = had;
  }
});
