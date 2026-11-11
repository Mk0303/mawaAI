/**
 * Send gestures: a tiny (<1.5 s) game plays on every tapped/flicked send.
 * Pure logic only (picking, judging, streaks) so it is unit-testable; the
 * animation lives in src/components/sendgames/SendGameLayer.tsx.
 * Enter and quick taps always send instantly; a miss still sends.
 */
import type { ThemeId } from "../themes/ids";

export const GAME_IDS = ["cricket", "basketball", "penalty", "slingshot", "dial", "charge", "bowling", "darts", "fishing", "plane", "rocket", "fetch"] as const;
export type GameId = (typeof GAME_IDS)[number];
export const isGameId = (x: unknown): x is GameId => typeof x === "string" && (GAME_IDS as readonly string[]).includes(x);

export type SendGameMode = "surprise" | "favorites" | "fixed" | "off";
export interface SendGameSettings { mode: SendGameMode; favorites: GameId[]; fixed: GameId | null }
export const DEFAULT_SEND_GAMES: SendGameSettings = { mode: "surprise", favorites: [], fixed: null };

/** How the player interacts: flick toward the target, pull back like a slingshot, spin, or hold. */
export type Gesture = "flick" | "pull" | "spin" | "hold";

export interface GameDef {
  id: GameId; name: string; gesture: Gesture; hint: string;
  /** Streak noun: "5 sixes in a row". */
  noun: [string, string];
  hit: string; miss: string;
}

export const GAMES: Record<GameId, GameDef> = {
  cricket: { id: "cricket", name: "Cricket boundary", gesture: "flick", hint: "Flick up from Send to hit a six", noun: ["six", "sixes"], hit: "SIX!", miss: "Edged. Still sent." },
  basketball: { id: "basketball", name: "Basketball hoop", gesture: "flick", hint: "Flick up in an arc to sink it", noun: ["swish", "swishes"], hit: "Swish!", miss: "Brick. Still sent." },
  penalty: { id: "penalty", name: "Penalty kick", gesture: "flick", hint: "Flick at the goal, beat the keeper", noun: ["goal", "goals"], hit: "GOAL!", miss: "Saved. Still sent." },
  slingshot: { id: "slingshot", name: "Slingshot", gesture: "pull", hint: "Pull back from Send and let go", noun: ["knockdown", "knockdowns"], hit: "Knocked down!", miss: "Whiff. Still sent." },
  dial: { id: "dial", name: "Rotate dial", gesture: "spin", hint: "Drag in a circle to crack the dial", noun: ["crack", "cracks"], hit: "Unlocked!", miss: "Jammed. Still sent." },
  charge: { id: "charge", name: "Charge blast", gesture: "hold", hint: "Hold Send to charge, release to blast", noun: ["blast", "blasts"], hit: "Full power!", miss: "Fizzled. Still sent." },
  bowling: { id: "bowling", name: "Bowling strike", gesture: "flick", hint: "Flick straight up for a strike", noun: ["strike", "strikes"], hit: "STRIKE!", miss: "Gutter. Still sent." },
  darts: { id: "darts", name: "Darts", gesture: "flick", hint: "Flick at the board for a bullseye", noun: ["bullseye", "bullseyes"], hit: "Bullseye!", miss: "Wall. Still sent." },
  fishing: { id: "fishing", name: "Fishing cast", gesture: "flick", hint: "Flick to cast the line", noun: ["catch", "catches"], hit: "Caught one!", miss: "Snagged. Still sent." },
  plane: { id: "plane", name: "Paper plane", gesture: "flick", hint: "Flick to throw the plane", noun: ["landing", "landings"], hit: "Smooth landing!", miss: "Nosedive. Still sent." },
  rocket: { id: "rocket", name: "Rocket launch", gesture: "hold", hint: "Hold to fuel, release to launch", noun: ["launch", "launches"], hit: "Liftoff!", miss: "Scrubbed. Still sent." },
  fetch: { id: "fetch", name: "Ball fetch", gesture: "flick", hint: "Throw the ball, the pup fetches", noun: ["fetch", "fetches"], hit: "Fetched!", miss: "Pup got distracted. Still sent." },
};

/** Each theme leans toward games that fit its world but still mixes in the rest. */
export const THEME_FLAVOR: Record<ThemeId, GameId[]> = {
  savage: ["charge", "darts", "rocket", "slingshot"],
  nature: ["fishing", "slingshot", "plane"],
  dogs: ["fetch", "basketball", "penalty"],
  horses: ["darts", "bowling", "cricket"],
  cosmic: ["rocket", "charge", "dial"],
  mountains: ["plane", "slingshot", "fishing"],
  mani: ["cricket", "plane", "dial", "penalty"],
  calm: ["plane", "fishing", "bowling"],
};
const FLAVOR_WEIGHT = 4;

/** Pick the next game: no repeat of the last `avoid` picks, flavoured games weighted up. */
export function pickGame(s: SendGameSettings, theme: ThemeId, recent: GameId[], rand: () => number = Math.random, avoid = 3): GameId | null {
  if (s.mode === "off") return null;
  if (s.mode === "fixed") return s.fixed && isGameId(s.fixed) ? s.fixed : null;
  const base: GameId[] = s.mode === "favorites" && s.favorites.length ? s.favorites.filter(isGameId) : [...GAME_IDS];
  if (base.length === 1) return base[0]!;
  const block = new Set(recent.slice(-Math.min(avoid, base.length - 1)));
  const pool = base.filter((g) => !block.has(g));
  const flavor = new Set(THEME_FLAVOR[theme]);
  const weights = pool.map((g) => (flavor.has(g) ? FLAVOR_WEIGHT : 1));
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= weights[i]!; if (r < 0) return pool[i]!; }
  return pool.at(-1) ?? null;
}

/** What the pointer did on the Send button. A plain tap has dx=dy=0 and a short duration. */
export interface Throw { dx: number; dy: number; ms: number; path: number; turn: number }

/** Decide hit/miss from the gesture. Taps get a friendly 70% auto-hit so non-gamers still win. */
export function judge(game: GameId, t: Throw, rand: () => number = Math.random): boolean {
  const g = GAMES[game].gesture;
  const dist = Math.hypot(t.dx, t.dy);
  const tapped = dist < 12 && t.ms < 350;
  if (tapped) return rand() < 0.7;
  switch (g) {
    case "flick": { // up and a little left (target sits above the composer, left of the button)
      const angle = (Math.atan2(-t.dy, -t.dx) * 180) / Math.PI; // 90 = straight up
      return t.dy < 0 && dist >= 40 && dist <= 260 && angle >= 50 && angle <= 140;
    }
    case "pull": return t.dy > 25 && dist >= 40 && dist <= 220; // drag down/back, release
    case "spin": return Math.abs(t.turn) >= 200 || t.path >= 260;
    case "hold": return t.ms >= 450 && t.ms <= 1600;
  }
}

export interface Streak { game: GameId | null; count: number }
/** Hits on the same game extend the streak; anything else resets it. */
export function nextStreak(prev: Streak, game: GameId, hit: boolean): Streak {
  if (!hit) return { game, count: 0 };
  return prev.game === game ? { game, count: prev.count + 1 } : { game, count: 1 };
}

const FLEX_LINES = ["Kohli who?", "Main character energy.", "Okay, show-off.", "Someone call the selectors.", "Unreal, mawa."];
const ROAST_LINES = ["Streak over. Classic.", "And the wheels fall off.", "Choked. We saw.", "Back to the nets."];
/** A short line for streaks of 3+ and for breaking one. */
export function streakLine(prev: Streak, next: Streak, rand: () => number = Math.random): string | null {
  const g = next.game ? GAMES[next.game] : null;
  if (!g) return null;
  if (next.count >= 3) return `${next.count} ${g.noun[1]} in a row. ${FLEX_LINES[Math.floor(rand() * FLEX_LINES.length)]}`;
  if (prev.count >= 3 && next.count === 0) return ROAST_LINES[Math.floor(rand() * ROAST_LINES.length)]!;
  return null;
}

export function parseSendGames(raw: unknown): SendGameSettings {
  try {
    const o = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<SendGameSettings>;
    const mode = (["surprise", "favorites", "fixed", "off"] as const).includes(o.mode as SendGameMode) ? (o.mode as SendGameMode) : "surprise";
    const favorites = Array.isArray(o.favorites) ? [...new Set(o.favorites.filter(isGameId))].slice(0, GAME_IDS.length) : [];
    const fixed = isGameId(o.fixed) ? o.fixed : null;
    return { mode, favorites, fixed };
  } catch {
    return { ...DEFAULT_SEND_GAMES };
  }
}
