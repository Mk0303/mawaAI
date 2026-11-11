import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SqliteStore } from "../src/lib/db/sqlite";
import { THEME_IDS, isThemeId } from "../src/lib/themes/ids";

const css = readFileSync(join(__dirname, "../src/app/globals.css"), "utf8");
const TOKENS = ["--t-ink", "--t-panel", "--t-line", "--t-fg", "--t-accent", "--t-accent-soft", "--t-roast", "--t-gold", "--t-care", "--t-bg", "--t-r-bot", "--t-r-user", "--t-r-chip", "--t-r-card", "--t-r-input", "--t-r-btn", "--t-bubble", "--t-roast-bg", "--t-flex-bg", "--t-care-bg", "--t-glow", "--t-scroll"];

test("every theme defines every design token", () => {
  for (const id of THEME_IDS) {
    const m = css.match(new RegExp(`\\[data-theme="${id}"\\] \\{([^}]*)\\}`));
    assert.ok(m, `no token block for ${id}`);
    for (const t of TOKENS) assert.ok(m![1]!.includes(t + ":"), `${id} is missing ${t}`);
  }
});

test("theme setting persists per user and rejects unknown ids", () => {
  const s = new SqliteStore(":memory:");
  const a = s.upsertUser({ email: "a@x.com", name: "A" });
  const b = s.upsertUser({ email: "b@x.com", name: "B" });
  assert.equal(s.getSettings(a.id).theme, "savage");
  s.saveSettings(a.id, { ...s.getSettings(a.id), theme: "mountains" });
  assert.equal(s.getSettings(a.id).theme, "mountains");
  assert.equal(s.getSettings(b.id).theme, "savage");
  s.saveSettings(a.id, { ...s.getSettings(a.id), theme: "<script>" as never });
  assert.equal(s.getSettings(a.id).theme, "savage");
  assert.ok(!isThemeId("doraemon"));
  assert.equal(THEME_IDS.length, 8);
});

test("reduced motion disables every ambient animation class", () => {
  const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  for (const cls of [...css.matchAll(/^\.(anim-[a-z-]+) \{ animation/gm)].map((m) => m[1]!)) assert.ok(block.includes("." + cls), `${cls} not disabled for reduced motion`);
});
