import { test } from "node:test";
import assert from "node:assert/strict";
import { GAME_IDS, THEME_FLAVOR, judge, nextStreak, parseSendGames, pickGame, streakLine, type GameId } from "../src/lib/sendgames/games";
import { THEME_IDS } from "../src/lib/themes/ids";
import { SqliteStore } from "../src/lib/db/sqlite";

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

test("surprise mode never repeats any of the last 3 games", () => {
  const r = seeded(42);
  const recent: GameId[] = [];
  for (let i = 0; i < 500; i++) {
    const g = pickGame({ mode: "surprise", favorites: [], fixed: null }, "dogs", recent, r)!;
    assert.ok(!recent.slice(-3).includes(g), `repeat ${g} at ${i}`);
    recent.push(g);
  }
  assert.ok(new Set(recent).size >= 10, "pool should mix in most games");
});

test("surprise mode leans toward the theme's games but mixes others", () => {
  for (const theme of THEME_IDS) {
    const r = seeded(7);
    const counts = new Map<GameId, number>();
    const recent: GameId[] = [];
    for (let i = 0; i < 2000; i++) { const g = pickGame({ mode: "surprise", favorites: [], fixed: null }, theme, recent, r)!; recent.push(g); counts.set(g, (counts.get(g) ?? 0) + 1); }
    const flavored = THEME_FLAVOR[theme].reduce((a, g) => a + (counts.get(g) ?? 0), 0);
    assert.ok(flavored / 2000 > THEME_FLAVOR[theme].length / GAME_IDS.length, `${theme} not weighted`);
    assert.ok(flavored / 2000 < 0.85, `${theme} never mixes`);
  }
});

test("favorites, fixed and off modes", () => {
  const r = seeded(3);
  const fav = { mode: "favorites" as const, favorites: ["darts", "bowling"] as GameId[], fixed: null };
  const got = new Set(Array.from({ length: 50 }, () => pickGame(fav, "savage", [], r)));
  assert.deepEqual([...got].sort(), ["bowling", "darts"]);
  // Two favorites: alternate rather than repeat.
  assert.equal(pickGame(fav, "savage", ["darts"], r), "bowling");
  assert.equal(pickGame({ mode: "fixed", favorites: [], fixed: "rocket" }, "mani", ["rocket", "rocket"], r), "rocket");
  assert.equal(pickGame({ mode: "off", favorites: [], fixed: null }, "mani", [], r), null);
});

test("gestures: flick up hits, sideways misses, taps mostly win, hold needs timing", () => {
  assert.equal(judge("cricket", { dx: -20, dy: -120, ms: 200, path: 125, turn: 0 }), true);
  assert.equal(judge("cricket", { dx: -150, dy: 10, ms: 200, path: 150, turn: 0 }), false);
  assert.equal(judge("slingshot", { dx: 5, dy: 80, ms: 400, path: 80, turn: 0 }), true);
  assert.equal(judge("charge", { dx: 0, dy: 0, ms: 800, path: 0, turn: 0 }), true);
  assert.equal(judge("charge", { dx: 0, dy: 0, ms: 2500, path: 0, turn: 0 }), false);
  assert.equal(judge("dial", { dx: 10, dy: 10, ms: 900, path: 300, turn: 260 }), true);
  assert.equal(judge("darts", { dx: 0, dy: 0, ms: 80, path: 0, turn: 0 }, () => 0.1), true);
  assert.equal(judge("darts", { dx: 0, dy: 0, ms: 80, path: 0, turn: 0 }, () => 0.9), false);
});

test("streaks count same-game hits and roast a broken streak", () => {
  let s = { game: null as GameId | null, count: 0 };
  for (let i = 0; i < 5; i++) s = nextStreak(s, "cricket", true);
  assert.equal(s.count, 5);
  assert.match(streakLine({ game: "cricket", count: 4 }, s, () => 0)!, /^5 sixes in a row\./);
  const broken = nextStreak(s, "cricket", false);
  assert.ok(streakLine(s, broken));
  assert.equal(nextStreak(s, "darts", true).count, 1);
});

test("send game settings are validated and persisted per user", () => {
  assert.deepEqual(parseSendGames('{"mode":"hack","favorites":["darts","<x>"],"fixed":"nope"}'), { mode: "surprise", favorites: ["darts"], fixed: null });
  assert.deepEqual(parseSendGames("not json"), { mode: "surprise", favorites: [], fixed: null });
  const st = new SqliteStore(":memory:");
  const a = st.upsertUser({ email: "a@x.com", name: "A" });
  st.saveSettings(a.id, { ...st.getSettings(a.id), sendGames: { mode: "fixed", favorites: [], fixed: "fetch" } });
  assert.deepEqual(st.getSettings(a.id).sendGames, { mode: "fixed", favorites: [], fixed: "fetch" });
});
