"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { GAMES, judge, nextStreak, pickGame, streakLine, type GameId, type SendGameSettings, type Streak, type Throw } from "@/lib/sendgames/games";
import type { ThemeId } from "@/lib/themes/ids";
import { useTheme } from "../theme/ThemeProvider";

/* ---------------- skins: base glyphs + per-theme reskins ---------------- */
type Skin = { ball: React.ReactNode; target: React.ReactNode; extra?: React.ReactNode };
const BASE: Record<GameId, Skin> = {
  cricket: { ball: "🔴", target: "🏏" }, basketball: { ball: "🏀", target: <Hoop /> }, penalty: { ball: "⚽", target: "🥅", extra: "🧤" },
  slingshot: { ball: "🪨", target: "🥫" }, dial: { ball: "", target: "🔒" }, charge: { ball: "⚡", target: "💥" },
  bowling: { ball: "🎳", target: "🎳" }, darts: { ball: <Dart />, target: "🎯" }, fishing: { ball: "🪝", target: "🌊", extra: "🐟" },
  plane: { ball: <Plane />, target: "☁️" }, rocket: { ball: "🚀", target: "🌙" }, fetch: { ball: "🎾", target: "🌳", extra: "🐕" },
};
const RESKIN: Partial<Record<ThemeId, Partial<Record<GameId, Partial<Skin>>>>> = {
  dogs: { cricket: { ball: "🎾" }, basketball: { ball: "🎾" }, slingshot: { ball: "🦴", target: "🐈" }, darts: { ball: "🦴" }, rocket: { ball: "🐕‍🦺" } },
  nature: { slingshot: { ball: "🌰", target: "🍎" }, darts: { ball: "🍃", target: "🌻" }, rocket: { ball: "🌱", target: "☀️" }, charge: { ball: "🍃", target: "🌸" } },
  cosmic: { darts: { ball: "☄️", target: "🪐" }, bowling: { ball: "🌑", target: "✨" }, fishing: { extra: "⭐", target: "🌌" }, fetch: { ball: "🌑", extra: "🐱" }, plane: { target: "🌙" } },
  horses: { slingshot: { ball: "🥕", target: "🎩" }, darts: { ball: "🧲", target: "🏆" }, fetch: { ball: "🍎", extra: "🐎" }, rocket: { ball: "🏇", target: "🏆" } },
  mountains: { slingshot: { ball: "⚪", target: "⛄" }, bowling: { ball: "⚪", target: "⛄" }, plane: { target: "🏔️" }, rocket: { target: "🏔️" }, fetch: { extra: "🐐" } },
  mani: { cricket: { ball: <CricketBall />, target: <Bat /> }, plane: { ball: <Glider />, target: "✦" }, rocket: { ball: <Glider />, target: "✦" }, dial: { target: "♞" } },
  // Calm: simple shapes only, no emoji.
  calm: {
    cricket: { ball: <Dot />, target: <Ring /> },
    basketball: { ball: <Dot c="var(--t-accent2)" />, target: <Ring /> },
    penalty: { ball: <Dot />, target: <Ring />, extra: <QuietBox /> },
    slingshot: { ball: <Dot c="var(--t-line)" />, target: <Ring /> },
    dial: { ball: "", target: <Ring /> },
    charge: { ball: <Dot />, target: <Ring /> },
    bowling: { ball: <Dot />, target: <Pins /> },
    darts: { ball: <Dart />, target: <Ring /> },
    fishing: { ball: <Hook />, target: <Wave />, extra: <FishMark /> },
    plane: { ball: <Plane />, target: <Horizon /> },
    rocket: { ball: <Dart />, target: <Ring /> },
    fetch: { ball: <Dot />, target: <Ring />, extra: <QuietBox /> },
  },
};
const skin = (g: GameId, t: ThemeId): Skin => ({ ...BASE[g], ...(RESKIN[t]?.[g] ?? {}) });

function Hoop() { return <svg width="34" height="28" viewBox="0 0 34 28"><rect x="5" y="0" width="24" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><ellipse cx="17" cy="16" rx="9" ry="3" fill="none" stroke="#f07b2e" strokeWidth="2.5" /><path d="M9 16 L12 27 M25 16 L22 27 M14 16 L15 27 M20 16 L19 27" stroke="currentColor" strokeWidth="0.8" /></svg>; }
function Dart() { return <svg width="22" height="10" viewBox="0 0 22 10"><path d="M0 5 H16" stroke="currentColor" strokeWidth="1.6" /><path d="M16 2 L22 5 L16 8Z" fill="currentColor" /><path d="M0 5 L4 1 M0 5 L4 9" stroke="var(--t-roast)" strokeWidth="1.5" /></svg>; }
function Plane() { return <svg width="24" height="20" viewBox="0 0 24 20"><path d="M1 10 L23 1 L15 19 L11 12Z" fill="var(--t-fg)" opacity="0.9" /><path d="M11 12 L23 1" stroke="var(--t-ink)" strokeWidth="0.8" /></svg>; }
function Glider() { return <svg width="26" height="22" viewBox="0 0 24 20" fill="none" stroke="var(--t-accent)" strokeLinecap="round"><path d="M2 7 Q12 -1 22 7 Q12 4 2 7Z" strokeWidth="1.6" /><path d="M2 7 12 17 22 7" strokeWidth="0.8" /><circle cx="12" cy="18" r="1.5" fill="var(--t-accent)" /></svg>; }
function CricketBall() { return <svg width="16" height="16" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#b5281d" /><path d="M6 5 Q14 14 6 23 M22 5 Q14 14 22 23" stroke="#f3dfae" strokeWidth="1.2" fill="none" strokeDasharray="1.4 1.2" /></svg>; }
function Bat() { return <svg width="30" height="30" viewBox="0 0 30 30"><path d="M4 26 L8 22 L22 6 L26 8 L12 26Z" fill="#d6ab52" /><path d="M4 26 L1 29" stroke="#8b5a2b" strokeWidth="3" strokeLinecap="round" /></svg>; }
function Dot({ c = "var(--t-accent)" }: { c?: string }) { return <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill={c} /></svg>; }
function Ring() { return <svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="11" fill="none" stroke="var(--t-accent)" strokeWidth="1.4" /></svg>; }
function Hook() { return <svg width="16" height="22" viewBox="0 0 16 22" fill="none" stroke="var(--t-fg)" strokeWidth="1.4" strokeLinecap="round"><path d="M8 1 v12 a5 5 0 1 1-5-5" /></svg>; }
function Pins() { return <svg width="28" height="22" viewBox="0 0 28 22"><g fill="var(--t-fg)" opacity="0.85"><rect x="4" y="6" width="4" height="14" rx="2" /><rect x="12" y="4" width="4" height="16" rx="2" /><rect x="20" y="6" width="4" height="14" rx="2" /></g></svg>; }
function Horizon() { return <svg width="34" height="16" viewBox="0 0 34 16" fill="none" stroke="var(--t-accent2)" strokeWidth="1.2"><path d="M2 12 H32" /><circle cx="26" cy="6" r="3" /></svg>; }
function Wave() { return <svg width="34" height="14" viewBox="0 0 34 14" fill="none" stroke="var(--t-accent)" strokeWidth="1.2"><path d="M1 8 q8-8 16 0 t16 0" /></svg>; }
function FishMark() { return <svg width="18" height="10" viewBox="0 0 18 10"><ellipse cx="8" cy="5" rx="6" ry="4" fill="var(--t-accent2)" /><path d="M14 5 L18 1 V9 Z" fill="var(--t-accent2)" /></svg>; }
function QuietBox() { return <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="3" fill="none" stroke="var(--t-fg)" strokeWidth="1.3" /></svg>; }

/* ---------------- state hook ---------------- */
const LS = { recent: "mawa.sg.recent", seen: "mawa.sg.seen", streak: "mawa.sg.streak" };
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

export interface Shot { key: number; game: GameId; hit: boolean; from: { x: number; y: number }; line: string | null }

export function useSendGames(settings: SendGameSettings) {
  const { theme } = useTheme();
  const [next, setNext] = useState<GameId | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const n = useRef(0);

  const repick = useCallback(() => {
    const g = pickGame(settings, theme.id, read<GameId[]>(LS.recent, []));
    setNext(g);
    // Hint until the game has been played once (marked seen in fire()).
    setHint(g && !read<GameId[]>(LS.seen, []).includes(g) ? GAMES[g].hint : null);
  }, [settings, theme.id]);
  useEffect(() => { repick(); }, [repick]);
  useEffect(() => { if (!hint) return; const t = setTimeout(() => setHint(null), 4000); return () => clearTimeout(t); }, [hint]);

  /** Called when Send fires. Returns nothing; sending never waits on the game. */
  const fire = useCallback((t: Throw, from: { x: number; y: number }) => {
    const g = next;
    if (!g) return;
    const hit = judge(g, t);
    const prev = read<Streak>(LS.streak, { game: null, count: 0 });
    const ns = nextStreak(prev, g, hit);
    write(LS.streak, ns);
    write(LS.recent, [...read<GameId[]>(LS.recent, []), g].slice(-6));
    const seen = read<GameId[]>(LS.seen, []);
    if (!seen.includes(g)) write(LS.seen, [...seen, g]);
    setShot({ key: ++n.current, game: g, hit, from, line: streakLine(prev, ns) });
    setHint(null);
    repick();
  }, [next, repick]);

  const done = useCallback(() => setShot(null), []);
  return { next, hint, shot, fire, done };
}

/* ---------------- overlay ---------------- */
const DUR = 1.25;
export function SendGameLayer({ shot, onDone }: { shot: Shot | null; onDone: () => void }) {
  const { theme, haptic } = useTheme();
  useEffect(() => { if (!shot) return; haptic(shot.hit ? "flex" : "tap"); const t = setTimeout(onDone, (DUR + 0.5) * 1000); return () => clearTimeout(t); }, [shot, onDone, haptic]);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      <AnimatePresence>{shot ? <Play key={shot.key} shot={shot} themeId={theme.id} /> : null}</AnimatePresence>
      <AnimatePresence>
        {shot?.line ? (
          <motion.div key={"s" + shot.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.6 }}
            className="t-chip absolute left-1/2 top-24 -translate-x-1/2 border border-gold/50 bg-panel/90 px-3 py-1.5 text-xs text-amber-200 shadow-lg backdrop-blur">
            {shot.line}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Play({ shot, themeId }: { shot: Shot; themeId: ThemeId }) {
  const s = skin(shot.game, themeId);
  const W = typeof window !== "undefined" ? window.innerWidth : 390;
  const H = typeof window !== "undefined" ? window.innerHeight : 844;
  const tx = W * 0.5, ty = H * 0.36;
  const dx = tx - shot.from.x, dy = ty - shot.from.y;
  const miss = !shot.hit;
  const g = shot.game;
  const T = { duration: DUR * 0.7, ease: "easeOut" as const };
  // Projectile path per game (relative to the Send button).
  const path: Record<GameId, object> = {
    cricket: miss ? { x: [0, -40, -70], y: [0, -60, -20], rotate: [0, 360] } : { x: [0, dx * 0.6, dx * 1.2], y: [0, dy * 1.6, dy * 2.2], rotate: [0, 720], scale: [1, 1.3, 0.6] },
    basketball: miss ? { x: [0, dx * 0.7, dx + 40], y: [0, dy * 1.4, dy + 60], rotate: [0, 300] } : { x: [0, dx * 0.6, dx], y: [0, dy * 1.5, dy + 6], rotate: [0, 300], scale: [1, 1, 0.8] },
    penalty: miss ? { x: [0, dx + 30], y: [0, dy + 10], scale: [1, 0.7] } : { x: [0, dx - 22], y: [0, dy - 6], scale: [1, 0.6], rotate: [0, 540] },
    slingshot: { x: [0, 14, dx + (miss ? 70 : 0)], y: [0, 30, dy + (miss ? -40 : 0)], scale: [1, 1.2, 0.8] },
    dial: {}, charge: { x: [0, dx], y: [0, dy], scale: [0.6, 2.4], opacity: [1, 1, miss ? 0 : 1] },
    bowling: { x: [0, dx * 0.5, dx + (miss ? 60 : 0)], y: [0, dy * 0.5, dy + 10], rotate: [0, 720] },
    darts: { x: [0, dx + (miss ? 50 : 0)], y: [0, dy + (miss ? -30 : 0)], rotate: [-Math.atan2(-dy, dx) * 57, -Math.atan2(-dy, dx) * 57] },
    fishing: { x: [0, dx * 0.5, dx], y: [0, dy * 1.4, dy + 20], rotate: [0, 40] },
    plane: miss ? { x: [0, dx * 0.5, dx * 0.6], y: [0, dy * 0.8, -dy * -0.1 + 40], rotate: [-30, 20, 120] } : { x: [0, dx * 0.4, dx, dx * 1.6], y: [0, dy * 0.9, dy - 30, dy - 80], rotate: [-30, -10, -40, -20] },
    rocket: miss ? { y: [0, -60, -40], x: [0, 10, 30], rotate: [0, 0, 70] } : { y: [0, -H], x: [0, dx * 0.2], scale: [1, 1.3] },
    fetch: { x: [0, dx * 0.6, dx], y: [0, dy * 1.4, dy + 30], rotate: [0, 400] },
  };
  return (
    <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
      {/* target */}
      {s.target ? (
        <motion.span className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center text-3xl text-white" style={{ left: tx, top: ty }}
          initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: [0, 1, 1, 0], scale: g === "dial" ? 1 : [0.6, 1, shot.hit ? 1.25 : 1, 1], rotate: g === "dial" ? [0, 200, 160, shot.hit ? 360 : 140] : g === "slingshot" && shot.hit ? [0, 0, 40, 80] : 0, y: g === "slingshot" && shot.hit ? [0, 0, -20, 40] : 0 }}
          transition={{ duration: DUR, times: [0, 0.2, 0.75, 1] }}>
          {g === "dial" && shot.hit ? <motion.span initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 1] }} transition={{ duration: DUR }}>🔓</motion.span> : s.target}
        </motion.span>
      ) : null}
      {/* helpers: keeper dives, dog runs, fish jumps */}
      {s.extra ? (
        <motion.span className="absolute -translate-x-1/2 -translate-y-1/2 text-2xl"
          style={{ left: g === "fetch" ? -40 : tx, top: g === "fetch" ? ty + 40 : ty + (g === "fishing" ? 20 : 0) }}
          animate={g === "penalty" ? { x: [0, shot.hit ? 30 : -30], rotate: [0, shot.hit ? 60 : -60], opacity: [0, 1, 1, 0] }
            : g === "fetch" ? { x: [0, tx + 40, tx + 40, shot.hit ? -60 : tx + 120], opacity: [0, 1, 1, 0], scaleX: [1, 1, -1, -1] }
            : { y: [0, 0, shot.hit ? -40 : 0, 0], opacity: [0, 0, shot.hit ? 1 : 0, 0], rotate: [0, 0, -30, 20] }}
          transition={{ duration: DUR, times: g === "fetch" ? [0, 0.45, 0.6, 1] : undefined }}>
          {s.extra}
        </motion.span>
      ) : null}
      {/* fishing line */}
      {g === "fishing" ? (
        <svg className="absolute inset-0 h-full w-full"><motion.path d={`M${shot.from.x} ${shot.from.y} Q ${(shot.from.x + tx) / 2} ${ty - 120} ${tx} ${ty + 20}`} stroke="var(--t-fg)" strokeWidth="1" fill="none" opacity="0.6" initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1, 0] }} transition={{ duration: DUR }} /></svg>
      ) : null}
      {/* charge beam */}
      {g === "charge" ? (
        <motion.span className="absolute h-2 origin-left rounded-full" style={{ left: shot.from.x, top: shot.from.y, width: Math.hypot(dx, dy), rotate: (Math.atan2(dy, dx) * 180) / Math.PI, background: "linear-gradient(90deg, var(--t-accent), var(--t-gold))", boxShadow: "0 0 18px var(--t-accent)" }}
          initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0] }} transition={{ duration: DUR * 0.8 }} />
      ) : null}
      {/* rocket flame trail */}
      {g === "rocket" && shot.hit ? <motion.span className="absolute w-1.5 origin-bottom rounded-full" style={{ left: shot.from.x - 3, top: 0, height: shot.from.y, background: "linear-gradient(to top, var(--t-roast), transparent)" }} initial={{ scaleY: 0, opacity: 0.9 }} animate={{ scaleY: 1, opacity: 0 }} transition={{ duration: DUR }} /> : null}
      {/* projectile */}
      {s.ball && g !== "dial" ? (
        <motion.span className="absolute -translate-x-1/2 -translate-y-1/2 text-2xl text-white" style={{ left: shot.from.x, top: shot.from.y }}
          initial={{ opacity: 1 }} animate={{ ...path[g], opacity: g === "charge" ? undefined : [1, 1, 0] }} transition={T}>
          {s.ball}
        </motion.span>
      ) : null}
      {/* result label */}
      <motion.span className={`t-chip absolute -translate-x-1/2 whitespace-nowrap border bg-panel/85 px-3 py-1 font-serif text-lg font-semibold shadow-lg backdrop-blur ${shot.hit ? "border-gold/50 text-gold" : "border-white/10 text-white/70"}`} style={{ left: tx, top: ty - 64 }}
        initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10], scale: [0.8, 1.1, 1, 1] }} transition={{ duration: DUR + 0.3, times: [0, 0.55, 0.85, 1], delay: 0.2 }}>
        {shot.hit ? GAMES[g].hit : GAMES[g].miss}
      </motion.span>
    </motion.div>
  );
}

/** Tiny badge on the Send button showing which game is up next, plus a first-time hint. */
export function NextGameBadge({ game, hint }: { game: GameId | null; hint: string | null }) {
  const { theme } = useTheme();
  if (!game) return null;
  const b = skin(game, theme.id).ball || skin(game, theme.id).target;
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute -right-1 -top-1 grid h-4 w-4 place-items-center overflow-hidden rounded-full bg-panel text-[9px] ring-1 ring-line [&_svg]:h-3 [&_svg]:w-3">{b}</span>
      <AnimatePresence>
        {hint ? (
          <motion.span role="status" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="t-chip pointer-events-none absolute bottom-12 right-0 w-max max-w-[220px] border border-cyan/40 bg-panel px-2.5 py-1.5 text-[11px] text-cyan-100 shadow-lg">
            {hint} <span className="text-white/40">· tap still sends</span>
          </motion.span>
        ) : null}
      </AnimatePresence>
    </>
  );
}
