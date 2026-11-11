"use client";
/**
 * Theme contract, layer 4: per-component renderers. Each map is typed
 * Record<ThemeId, ...>, so adding a theme id without a variant here is a
 * compile error. Components import these instead of drawing their own.
 */
import { AnimatePresence, motion, type HTMLMotionProps, type TargetAndTransition } from "framer-motion";
import { forwardRef, useEffect, useRef, useState } from "react";
import type { ThemeId } from "@/lib/themes/ids";
import { useTheme } from "./ThemeProvider";

const loop = (duration: number, delay = 0) => ({ repeat: Infinity, duration, delay, ease: "easeInOut" as const });
const useId = (override?: ThemeId) => { const { theme } = useTheme(); return override ?? theme.id; };

/* ------------------------------ icons ------------------------------ */
export const ICONS: Record<ThemeId, { harder: string; nicer: string; harderLabel: string; nicerLabel: string; empty: string; error: string; mic: string }> = {
  savage: { harder: "🔥", nicer: "😇", harderLabel: "Roast harder", nicerLabel: "Be nice", empty: "⚡", error: "💥", mic: "🎙️" },
  nature: { harder: "🌶️", nicer: "🌸", harderLabel: "Spicier", nicerLabel: "Softer", empty: "🌱", error: "🍂", mic: "🎙️" },
  dogs: { harder: "🦴", nicer: "🐾", harderLabel: "Bite harder", nicerLabel: "Belly rubs", empty: "🎾", error: "🙀", mic: "🎙️" },
  horses: { harder: "🏇", nicer: "🌾", harderLabel: "Spur it", nicerLabel: "Easy now", empty: "🐎", error: "🪨", mic: "🎙️" },
  cosmic: { harder: "☄️", nicer: "🌙", harderLabel: "Supernova", nicerLabel: "Moonlight", empty: "🪐", error: "🛰️", mic: "🎙️" },
  mountains: { harder: "🌋", nicer: "☁️", harderLabel: "Avalanche", nicerLabel: "Breeze", empty: "🏔️", error: "🪨", mic: "🎙️" },
  // Mani Mode: English only, no emoji. Plain glyphs.
  mani: { harder: "▲", nicer: "▽", harderLabel: "More heat", nicerLabel: "Calm down", empty: "✦", error: "!", mic: "" },
  calm: { harder: "›", nicer: "‹", harderLabel: "More heat", nicerLabel: "Softer", empty: "○", error: "!", mic: "" },
};
export const useIcons = (t?: ThemeId) => ICONS[useId(t)];

/* ------------------------------ send glyph ------------------------------ */
const SEND: Record<ThemeId, () => React.ReactElement> = {
  savage: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>,
  nature: () => <svg width="20" height="20" viewBox="0 0 24 24"><path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15Z" fill="currentColor" /><path d="M5 19 14 10" stroke="var(--t-ink)" strokeWidth="1.6" /></svg>,
  dogs: () => <svg width="22" height="22" viewBox="0 0 32 32"><g fill="currentColor"><ellipse cx="16" cy="21" rx="7" ry="6" /><circle cx="8" cy="13" r="3" /><circle cx="13" cy="8" r="3" /><circle cx="19" cy="8" r="3" /><circle cx="24" cy="13" r="3" /></g></svg>,
  horses: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 20V11a6 6 0 0 1 12 0v9" /><path d="M4 20h4M16 20h4" /></svg>,
  cosmic: () => <svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 2c4 3 5 8 4 12l-4 3-4-3c-1-4 0-9 4-12Z" fill="currentColor" /><circle cx="12" cy="9" r="2" fill="var(--t-ink)" /><path d="M9 17l-2 4M15 17l2 4M12 18v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>,
  mountains: () => <svg width="20" height="20" viewBox="0 0 24 24"><path d="M2 20 9 8l4 6 2-3 7 9Z" fill="currentColor" /><path d="M9 8l-2 3.5 2-1 2 1.5Z" fill="var(--t-ink)" /></svg>,
  // Paper-plane paraglider.
  mani: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round"><path d="M3 9 Q12 1 21 9 Q12 6 3 9Z" strokeWidth="1.6" /><path d="M3 9 12 19 21 9M8 6.5 12 19M16 6.5 12 19" strokeWidth="0.9" /><circle cx="12" cy="20" r="1.4" fill="currentColor" /></svg>,
  // Quiet arrow: no fill, no trail.
  calm: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" opacity="0.45" /><path d="M8 12h8M13 8l4 4-4 4" /></svg>,
};
/**
 * Send button: shape, glyph and take-off animation come from the theme.
 * It also reads the send gesture (tap, flick, pull, spin, hold) and reports it
 * via onFire; sending itself never waits for, or depends on, the game.
 */
export const SendButton = forwardRef<HTMLButtonElement, {
  disabled?: boolean; onSend: () => void;
  onFire?: (t: { dx: number; dy: number; ms: number; path: number; turn: number }, from: { x: number; y: number }) => void;
  badge?: React.ReactNode;
}>(function SendButton({ disabled, onSend, onFire, badge }, ref) {
  const { theme, haptic } = useTheme();
  const Glyph = SEND[theme.id];
  const [launch, setLaunch] = useState(0);
  const [charge, setCharge] = useState(false);
  const g = useRef<{ x: number; y: number; t: number; lx: number; ly: number; path: number; turn: number; la: number | null } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const setRefs = (el: HTMLButtonElement | null) => {
    btn.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };
  const flight: Record<ThemeId, TargetAndTransition> = {
    savage: { y: [0, -14, 0], opacity: [1, 0, 1] }, nature: { rotate: [0, 30, 0], scale: [1, 1.3, 1] }, dogs: { rotate: [0, -20, 20, 0], y: [0, -6, 0] },
    horses: { x: [0, 10, -10, 0], opacity: [1, 0, 0, 1] }, cosmic: { y: [0, -24, 12, 0], opacity: [1, 0, 0, 1] }, mountains: { y: [0, -8, 0], x: [0, 6, 0] },
    mani: { y: [0, -30, 10, 0], x: [0, -10, 0, 0], rotate: [0, -12, 0, 0], opacity: [1, 0, 0, 1] },
    calm: { y: [0, -6, 0], opacity: [1, 0.4, 1] },
  };
  const fire = (t: { dx: number; dy: number; ms: number; path: number; turn: number }) => {
    if (disabled) return;
    const r = btn.current?.getBoundingClientRect();
    haptic("send"); setLaunch((n) => n + 1);
    onFire?.(t, r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 });
    onSend();
  };
  return (
    <motion.button ref={setRefs} type="button" disabled={disabled} aria-label="Send" style={{ position: "relative", touchAction: "none" }}
      whileTap={theme.motion.press} whileHover={theme.motion.hover} animate={charge ? { scale: [1, 1.12, 1.08], boxShadow: "0 0 26px var(--t-accent)" } : {}}
      onPointerDown={(e) => { if (disabled) return; e.currentTarget.setPointerCapture(e.pointerId); g.current = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY, path: 0, turn: 0, la: null }; setTimeout(() => { if (g.current) setCharge(true); }, 350); }}
      onPointerMove={(e) => {
        const s = g.current; if (!s) return;
        s.path += Math.hypot(e.clientX - s.lx, e.clientY - s.ly); s.lx = e.clientX; s.ly = e.clientY;
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 20) {
          const a = Math.atan2(e.clientY - s.y, e.clientX - s.x) * 57.2958;
          if (s.la !== null) { let d = a - s.la; if (d > 180) d -= 360; if (d < -180) d += 360; s.turn += d; }
          s.la = a;
        }
      }}
      onPointerUp={(e) => { const s = g.current; g.current = null; setCharge(false); if (!s) return; fire({ dx: e.clientX - s.x, dy: e.clientY - s.y, ms: performance.now() - s.t, path: s.path, turn: s.turn }); }}
      onPointerCancel={() => { g.current = null; setCharge(false); }}
      onClick={(e) => { if (e.detail === 0) fire({ dx: 0, dy: 0, ms: 0, path: 0, turn: 0 }); /* keyboard activation */ }}
      className={`t-btn grid h-10 w-10 shrink-0 place-items-center overflow-visible shadow-[0_0_16px_var(--t-glow)] disabled:opacity-30 ${theme.id === "mani" ? "border-2 border-cyan bg-ink text-cyan" : theme.id === "calm" ? "border border-cyan/30 bg-panel text-cyan" : "bg-cyan text-ink"}`}>
      {theme.id === "mani" && launch ? <motion.span key={"trail" + launch} aria-hidden className="pointer-events-none absolute h-16 w-[2px] rounded-full" style={{ background: "linear-gradient(to top, transparent, var(--t-accent))", originY: 1 }} initial={{ opacity: 0.9, y: 0, scaleY: 0.2 }} animate={{ opacity: 0, y: -50, scaleY: 1 }} transition={{ duration: 0.6, ease: "easeOut" }} /> : null}
      <motion.span key={launch} animate={launch ? flight[theme.id] : {}} transition={{ duration: 0.4 }} className="grid place-items-center"><Glyph /></motion.span>
      {badge}
    </motion.button>
  );
});

/* ------------------------------ typing indicator ------------------------------ */
const TYPING: Record<ThemeId, () => React.ReactElement> = {
  savage: () => <>{[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-cyan" animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }} transition={loop(0.9, i * 0.15)} />)}</>,
  nature: () => <>{[0, 1, 2].map((i) => (
    <motion.svg key={i} width="12" height="12" viewBox="0 0 24 24" animate={{ scale: [0.3, 1, 0.3], rotate: [0, 20, 0] }} transition={loop(1.4, i * 0.25)}><path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16Z" fill="var(--t-accent)" /></motion.svg>
  ))}</>,
  dogs: () => <>{[0, 1, 2, 3].map((i) => (
    <motion.svg key={i} width="12" height="12" viewBox="0 0 32 32" style={{ rotate: i % 2 ? 15 : -15, y: i % 2 ? 3 : -3 }} animate={{ opacity: [0, 1, 0] }} transition={loop(1.6, i * 0.3)}>
      <g fill="var(--t-accent)"><ellipse cx="16" cy="21" rx="7" ry="6" /><circle cx="8" cy="13" r="3" /><circle cx="13" cy="8" r="3" /><circle cx="19" cy="8" r="3" /><circle cx="24" cy="13" r="3" /></g>
    </motion.svg>
  ))}</>,
  // Four hoofbeats: gallop rhythm (da-da-da-dum).
  horses: () => <>{[0, 1, 2, 3].map((i) => <motion.span key={i} className="h-2 w-1.5 rounded-sm bg-cyan" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: [0, 0.08, 0.16, 0.36][i], repeatDelay: 0.2 }} />)}</>,
  cosmic: () => (
    <span className="relative inline-block h-4 w-8">
      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold" />
      {[0, 1].map((i) => (
        <motion.span key={i} className="absolute inset-0" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.6 + i * 0.8, ease: "linear" }}>
          <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cyan" style={{ left: i ? "2px" : "-2px" }} />
        </motion.span>
      ))}
    </span>
  ),
  mountains: () => <>{[0, 1, 2].map((i) => <motion.span key={i} className="text-[11px] leading-none text-cyan" animate={{ y: [-4, 4], opacity: [0, 1, 0] }} transition={loop(1.5, i * 0.4)}>❄</motion.span>)}</>,
  // Three stars joining into a constellation.
  mani: () => (
    <svg width="34" height="12" viewBox="0 0 34 12">
      <motion.path d="M3 8 L17 3 L31 8" stroke="var(--t-accent)" strokeWidth="0.8" fill="none" animate={{ pathLength: [0, 1, 1, 0] }} transition={loop(1.6)} />
      {[[3, 8], [17, 3], [31, 8]].map(([x, y], i) => <motion.circle key={i} cx={x} cy={y} r="1.8" fill="var(--t-accent-soft)" animate={{ opacity: [0.3, 1, 0.3] }} transition={loop(1.2, i * 0.2)} />)}
    </svg>
  ),
  // Slow opacity only; no bounce.
  calm: () => <>{[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-cyan/70" animate={{ opacity: [0.22, 0.75, 0.22] }} transition={loop(1.8, i * 0.3)} />)}</>,
};
export function TypingIndicator({ themeId, label }: { themeId?: ThemeId; label?: string }) {
  const { theme } = useTheme();
  const T = TYPING[themeId ?? theme.id];
  return <span className="inline-flex items-center gap-1 py-1" role="status" aria-label={label ?? theme.copy.typing}><T /></span>;
}

/* ------------------------------ press button ------------------------------ */
type PressProps = HTMLMotionProps<"button"> & { haptic?: "tap" | "send" | "swipe" | false };
/** Every tappable control uses this so press/hover feel and haptics follow the theme. */
export const PressButton = forwardRef<HTMLButtonElement, PressProps>(function PressButton({ haptic: h = "tap", onClick, ...rest }, ref) {
  const { theme, haptic } = useTheme();
  return <motion.button ref={ref} whileTap={theme.motion.press} whileHover={theme.motion.hover} onClick={(e) => { if (h) haptic(h); onClick?.(e); }} {...rest} />;
});

/* ------------------------------ toggle ------------------------------ */
const KNOB: Record<ThemeId, (on: boolean) => React.ReactElement> = {
  savage: () => <span className="block h-5 w-5 rounded-full bg-[var(--t-fg)] shadow-[0_0_10px_var(--t-glow)]" />,
  nature: (on) => <motion.svg width="22" height="22" viewBox="0 0 24 24" animate={{ rotate: on ? 0 : -90 }}><path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16Z" fill={on ? "#e8f2e2" : "#9bb5a0"} /></motion.svg>,
  dogs: (on) => <motion.span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[13px] shadow" animate={{ rotate: on ? 360 : 0 }}>🐾</motion.span>,
  horses: (on) => <motion.svg width="22" height="22" viewBox="0 0 24 24" animate={{ rotate: on ? 0 : 180 }}><path d="M6 20V11a6 6 0 0 1 12 0v9" stroke="#f4e8d2" strokeWidth="3" fill="none" strokeLinecap="round" /></motion.svg>,
  cosmic: (on) => <motion.span className="block h-5 w-5 rounded-full" animate={{ background: on ? "#ffd447" : "#bcd6ff", boxShadow: on ? "0 0 12px #ffd447" : "inset -5px -2px 0 #6b84c4" }} />,
  mountains: (on) => <motion.svg width="22" height="22" viewBox="0 0 24 24" animate={{ y: on ? -1 : 1 }}><path d="M2 20 9 8l4 6 2-3 7 9Z" fill={on ? "#ffffff" : "#8aa0b4"} /><path d="M9 8l-2 3.5 2-1 2 1.5Z" fill="#2e6ea6" /></motion.svg>,
  // Gold chess pawn: upright when on, tipped on its side when off.
  mani: (on) => (
    <motion.svg width="20" height="26" viewBox="0 0 20 26" animate={{ rotate: on ? 0 : -90, y: on ? -2 : 3 }} transition={{ type: "tween", ease: "easeOut", duration: 0.25 }} style={{ originX: "50%", originY: "90%" }}>
      <defs><linearGradient id="pawn" x1="0" x2="1"><stop offset="0" stopColor="#f6e3b2" /><stop offset="0.5" stopColor="#d6ab52" /><stop offset="1" stopColor="#8a6a2a" /></linearGradient></defs>
      <circle cx="10" cy="6" r="4" fill="url(#pawn)" /><path d="M7 10h6l-1 2 2 8H6l2-8Z" fill="url(#pawn)" /><rect x="3" y="20" width="14" height="4" rx="1.5" fill="url(#pawn)" />
    </motion.svg>
  ),
  calm: () => <span className="block h-5 w-5 rounded-full bg-[var(--t-fg)]" />,
};
/** Track shape differs per theme: a bone for Dogs, a leather strap for Horses, a vine for Nature… */
const TRACK: Record<ThemeId, string> = {
  savage: "rounded-full", nature: "rounded-[14px_18px_14px_18px]", dogs: "",
  horses: "rounded-md border border-gold/40", cosmic: "rounded-full", mountains: "rounded-lg",
  mani: "rounded-sm border border-gold/40 [background-image:linear-gradient(90deg,transparent_50%,rgba(214,171,82,0.14)_50%)]",
  calm: "rounded-md",
};
export function ThemedToggle({ on, onChange, label, locked }: { on: boolean; onChange?: (v: boolean) => void; label: string; locked?: boolean }) {
  const { theme, haptic } = useTheme();
  const dogs = theme.id === "dogs";
  return (
    <motion.button type="button" role="switch" aria-checked={on} aria-label={label} disabled={locked} whileTap={theme.motion.press}
      onClick={() => { haptic("tap"); onChange?.(!on); }}
      className={`relative h-8 w-14 shrink-0 transition-colors ${TRACK[theme.id]} ${dogs ? "" : theme.id === "mani" ? (on ? "bg-gold/20" : "bg-ink/70") : on ? "bg-cyan" : "bg-white/15"} ${locked ? "opacity-80" : ""}`}>
      {dogs ? (
        // Dog theme: the track is a bone.
        <svg viewBox="0 0 56 32" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d="M9 4a6 6 0 0 1 6 5h26a6 6 0 1 1 6 7 6 6 0 1 1-6 7H15a6 6 0 1 1-6-7 6 6 0 0 1 0-12Z" transform="translate(0 0)" fill={on ? "var(--t-accent)" : "color-mix(in oklab, var(--t-fg) 15%, transparent)"} />
        </svg>
      ) : null}
      <motion.span className="absolute top-1/2 grid -translate-y-1/2 place-items-center" animate={{ left: on ? 30 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
        {KNOB[theme.id](on)}
      </motion.span>
      {locked ? <span className="absolute -bottom-2 -right-2 text-xs" aria-hidden>🔒</span> : null}
    </motion.button>
  );
}

/* ------------------------------ slider ------------------------------ */
const THUMB: Record<ThemeId, (moving: boolean) => React.ReactElement> = {
  savage: () => <span className="block h-5 w-5 rounded-full bg-[var(--t-fg)] shadow-[0_0_14px_var(--t-accent)]" />,
  nature: () => <svg width="26" height="26" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#e07a3a" /><path d="M12 5c1-3 4-4 6-3-1 3-4 4-6 3Z" fill="#7cd38a" /></svg>,
  dogs: (m) => <motion.span className="grid h-7 w-7 place-items-center rounded-full bg-white text-base shadow" animate={m ? { rotate: [0, -20, 20, 0] } : {}} transition={{ duration: 0.4 }}>🎾</motion.span>,
  // Horseshoe that gallops (bobs) while it moves.
  horses: (m) => (
    <motion.svg width="26" height="26" viewBox="0 0 24 24" animate={m ? { y: [0, -7, 0, -7, 0], rotate: [0, -10, 0, 10, 0] } : { y: 0 }} transition={{ duration: 0.5 }}>
      <path d="M6 21V11a6 6 0 0 1 12 0v10" stroke="#cfa64e" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      {[7, 10, 14, 17].map((x, i) => <circle key={i} cx={x < 12 ? 6 : 18} cy={[17, 12, 12, 17][i]} r="0.9" fill="#1b120a" />)}
    </motion.svg>
  ),
  cosmic: () => <span className="block h-6 w-6 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #ffe48a, #ffb300)", boxShadow: "0 0 14px #ffd447" }} />,
  mountains: (m) => (
    <motion.svg width="24" height="28" viewBox="0 0 24 28" animate={m ? { rotate: [0, -8, 8, 0] } : {}} transition={{ duration: 0.4 }}>
      <path d="M6 26V3" stroke="var(--t-fg)" strokeWidth="2" strokeLinecap="round" /><path d="M6 3h14l-4 5 4 5H6Z" fill="var(--t-roast)" />
    </motion.svg>
  ),
  // Stitched red cricket ball; the seam spins as it rolls down the pitch.
  mani: (m) => (
    <motion.svg width="28" height="28" viewBox="0 0 28 28" animate={m ? { rotate: [0, 360] } : {}} transition={{ duration: 0.5, ease: "easeOut" }}>
      <defs><radialGradient id="ball" cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#e2584a" /><stop offset="1" stopColor="#7a1410" /></radialGradient></defs>
      <circle cx="14" cy="14" r="12" fill="url(#ball)" />
      <path d="M6 5 Q14 14 6 23 M22 5 Q14 14 22 23" stroke="#f3dfae" strokeWidth="0.9" fill="none" strokeDasharray="1.4 1.2" />
    </motion.svg>
  ),
  calm: () => <span className="block h-5 w-5 rounded-full border border-cyan/40 bg-[var(--t-panel)]" />,
};
/** Track decoration filled up to the thumb: a growing vine, a climbing path, a hoof-printed trail… */
function SliderTrack({ id, pct }: { id: ThemeId; pct: number }) {
  if (id === "nature") {
    return (
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 20" preserveAspectRatio="none">
        <path d="M0 10 Q12 2 25 10 T50 10 T75 10 T100 10" stroke="var(--t-line)" strokeWidth="2" fill="none" />
        <motion.path d="M0 10 Q12 2 25 10 T50 10 T75 10 T100 10" stroke="var(--t-accent)" strokeWidth="3" fill="none" strokeLinecap="round" initial={false} animate={{ pathLength: pct / 100 }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        {[18, 42, 66, 90].map((x) => <motion.ellipse key={x} cx={x} cy={x % 2 ? 4 : 15} rx="4" ry="2" fill="var(--t-accent)" initial={false} animate={{ scale: pct >= x ? 1 : 0 }} style={{ originX: `${x}px`, originY: "10px" }} />)}
      </svg>
    );
  }
  if (id === "mountains") {
    // A switch-back path climbing to a summit; the walked part turns solid.
    const d = "M0 18 L20 14 L32 16 L50 9 L62 11 L80 4 L100 2";
    return (
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 20" preserveAspectRatio="none">
        <path d="M0 20 L20 12 L32 15 L50 6 L62 9 L80 1 L100 0 V20Z" fill="var(--t-line)" opacity="0.5" />
        <path d={d} stroke="var(--t-accent2)" strokeWidth="1.4" fill="none" strokeDasharray="2 2" />
        <motion.path d={d} stroke="var(--t-accent)" strokeWidth="2.4" fill="none" initial={false} animate={{ pathLength: pct / 100 }} transition={{ duration: 0.5 }} />
      </svg>
    );
  }
  if (id === "mani") {
    // Cricket pitch with crease lines; the worn part behind the ball darkens.
    return (
      <div className="absolute inset-x-0 top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-sm border border-gold/40" style={{ background: "linear-gradient(180deg, #d9c48a, #bfa767)" }}>
        <motion.div className="h-full" style={{ background: "linear-gradient(90deg, rgba(120,90,40,0.35), rgba(120,90,40,0.15))" }} initial={false} animate={{ width: `${pct}%` }} transition={{ type: "tween", ease: "easeOut", duration: 0.28 }} />
        {[6, 10, 50, 90, 94].map((x) => <span key={x} className="absolute inset-y-0 w-px bg-white/80" style={{ left: `${x}%` }} />)}
      </div>
    );
  }
  const fill: Record<ThemeId, string> = {
    mani: "",
    savage: "linear-gradient(90deg, var(--t-accent), var(--t-accent2), var(--t-roast))", nature: "", mountains: "",
    dogs: "repeating-linear-gradient(90deg, var(--t-accent) 0 10px, color-mix(in oklab, var(--t-accent) 70%, white) 10px 20px)",
    horses: "linear-gradient(90deg, #6b4226, var(--t-accent))", cosmic: "linear-gradient(90deg, #4ea9ff, #a78bfa, #ff6b8b)",
    calm: "var(--t-accent)",
  };
  return (
    <div className={`absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden ${id === "horses" ? "rounded-sm border border-gold/30" : "rounded-full"} bg-white/10`}>
      <motion.div className="h-full" style={{ background: fill[id] }} initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 160, damping: 22 }} />
      {id === "cosmic" ? [10, 30, 55, 80].map((x) => <span key={x} className="absolute top-1/2 h-0.5 w-0.5 -translate-y-1/2 rounded-full bg-white" style={{ left: `${x}%` }} />) : null}
    </div>
  );
}
export function ThemedSlider({ value, steps, onChange, label, labels }: { value: number; steps: number; onChange: (v: number) => void; label: string; labels?: string[] }) {
  const { theme, haptic } = useTheme();
  const [moving, setMoving] = useState(false);
  const prev = useRef(value);
  useEffect(() => { if (prev.current !== value) { setMoving(true); const t = setTimeout(() => setMoving(false), 500); prev.current = value; return () => clearTimeout(t); } }, [value]);
  const pct = steps > 1 ? (value / (steps - 1)) * 100 : 0;
  const pick = (v: number) => { const c = Math.max(0, Math.min(steps - 1, v)); if (c !== value) { haptic("tap"); onChange(c); } };
  const ref = useRef<HTMLDivElement>(null);
  const fromX = (clientX: number) => { const r = ref.current!.getBoundingClientRect(); pick(Math.round(((clientX - r.left) / r.width) * (steps - 1))); };
  return (
    <div className="w-full">
      <div ref={ref} role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={steps - 1} aria-valuenow={value} aria-valuetext={labels?.[value]}
        onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowUp") pick(value + 1); if (e.key === "ArrowLeft" || e.key === "ArrowDown") pick(value - 1); }}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); fromX(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons) fromX(e.clientX); }}
        className="relative mx-3 h-10 touch-none outline-none focus-visible:ring-2 focus-visible:ring-cyan/50">
        <SliderTrack id={theme.id} pct={pct} />
        <motion.div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" initial={false} animate={{ left: `${pct}%` }} transition={{ type: "spring", stiffness: 220, damping: 22 }}>
          {THUMB[theme.id](moving)}
        </motion.div>
      </div>
      {labels ? <div className="mt-1 flex justify-between px-1 text-[11px] text-white/50">{labels.map((l, i) => <span key={l} className={i === value ? "text-cyan" : ""}>{l}</span>)}</div> : null}
    </div>
  );
}

/* ------------------------------ progress ------------------------------ */
const RUNNER: Record<ThemeId, React.ReactNode> = {
  savage: "⚡", nature: "🐛", dogs: "🐕", horses: "🐎", cosmic: "🚀", mountains: "🐐",
  mani: <svg width="22" height="18" viewBox="0 0 24 20" fill="none" stroke="var(--t-accent)" strokeLinecap="round"><path d="M2 7 Q12 -1 22 7 Q12 4 2 7Z" strokeWidth="1.5" /><path d="M2 7 12 17 22 7" strokeWidth="0.8" /><circle cx="12" cy="18" r="1.4" fill="var(--t-accent)" /></svg>,
  calm: <span className="block h-2.5 w-2.5 rounded-full bg-cyan" />,
};
/** Progress bar with a theme "runner" riding the leading edge (rides, crawls, flies, climbs). */
export function ThemedProgress({ pct, label }: { pct: number; label?: string }) {
  const { theme } = useTheme();
  const id = theme.id;
  const bar: Record<ThemeId, string> = {
    savage: "linear-gradient(90deg, var(--t-accent), var(--t-accent2))",
    nature: "repeating-linear-gradient(135deg, var(--t-accent) 0 8px, #4f9d5c 8px 16px)",
    dogs: "repeating-linear-gradient(90deg, var(--t-accent) 0 14px, #ffb27a 14px 28px)",
    horses: "linear-gradient(90deg, #6b4226, var(--t-accent))",
    cosmic: "linear-gradient(90deg, #4ea9ff, #a78bfa, #ffd447)",
    mountains: "linear-gradient(90deg, var(--t-accent2), var(--t-accent))",
    mani: "linear-gradient(90deg, #e8843b, #d6ab52, #f3dfae)",
    calm: "var(--t-accent)",
  };
  return (
    <div className="relative pt-6" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label ?? "Progress"}>
      <motion.span className="absolute top-0 -translate-x-1/2 text-lg" initial={false} animate={{ left: `${pct}%` }} transition={{ duration: 0.4 }}>
        <motion.span className="inline-block" style={{ scaleX: id === "horses" || id === "dogs" || id === "nature" ? -1 : 1 }}
          animate={id === "horses" ? { y: [0, -4, 0] } : id === "cosmic" ? { rotate: 45, x: [0, 2, 0] } : id === "mountains" ? { y: [0, -2, 0], rotate: [-5, 5, -5] } : { y: [0, -2, 0] }}
          transition={loop(id === "horses" ? 0.35 : 0.8)}>{RUNNER[id]}</motion.span>
      </motion.span>
      <div className={`h-2.5 overflow-hidden bg-white/10 ${id === "horses" ? "rounded-sm" : id === "mountains" ? "rounded-md" : "rounded-full"}`}>
        <motion.div className="h-full" style={{ background: bar[id], backgroundSize: id === "nature" || id === "dogs" ? "auto" : "200% 100%" }} initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
      </div>
    </div>
  );
}

/* ------------------------------ mood effects on bubbles ------------------------------ */
const FX: Record<ThemeId, Partial<Record<"flex" | "roast" | "care", string[]>>> = {
  savage: { flex: ["✦", "⚡"], roast: ["🔥"], care: ["💙"] },
  nature: { flex: ["🌼", "✿", "🍃"], roast: ["🌶️", "🍂"], care: ["🌸"] },
  dogs: { flex: ["🦴", "🐾", "⭐"], roast: ["💢", "🦴"], care: ["🐾", "💛"] },
  horses: { flex: ["🏆", "✦"], roast: ["💨", "🔥"], care: ["🌾"] },
  cosmic: { flex: ["⭐", "✨", "🌟"], roast: ["☄️", "💥"], care: ["🌙", "✨"] },
  mountains: { flex: ["☀️", "🚩"], roast: ["🌋", "🪨"], care: ["❄️", "☁️"] },
  mani: { flex: ["✦", "·", "✧"], roast: ["✦", "·"], care: ["✧", "·"] },
  calm: { flex: ["·", "○"], roast: ["·"], care: ["·"] },
};
/** A short burst of theme particles when a reply lands with a mood. Pure motion, no sound. */
export function MoodFx({ mood }: { mood?: string | null }) {
  const { theme } = useTheme();
  const items = mood === "flex" || mood === "roast" || mood === "care" ? FX[theme.id][mood] : undefined;
  if (!items) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: 6 }, (_, i) => (
        <motion.span key={i} className="absolute -top-2 text-xs" style={{ left: `${8 + i * 16}%` }}
          initial={{ opacity: 0, y: 0, scale: 0.4 }} animate={{ opacity: [0, 1, 0], y: mood === "roast" ? [0, -16 - i * 3] : [0, -26 - i * 4], x: (i - 2.5) * 6, scale: [0.4, 1.1, 0.8], rotate: (i - 2.5) * 20 }}
          transition={{ duration: 1.2, delay: i * 0.06 }}>{items[i % items.length]}</motion.span>
      ))}
    </span>
  );
}

/* ------------------------------ empty / error ------------------------------ */
export function EmptyState({ text, compact }: { text: string; compact?: boolean }) {
  const { theme } = useTheme();
  return (
    <div className={`flex items-center gap-2 ${compact ? "py-1" : "flex-col py-6 text-center"}`}>
      <motion.span className={compact ? "text-base" : "text-3xl"} animate={{ y: [0, -4, 0], rotate: [0, -6, 6, 0] }} transition={loop(3)}>{ICONS[theme.id].empty}</motion.span>
      <p className="text-xs text-white/40">{text}</p>
    </div>
  );
}
export function ErrorNote({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const { theme, haptic } = useTheme();
  useEffect(() => { haptic("error"); }, [haptic]);
  return (
    <motion.div role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      className="t-chip mt-2 flex items-center gap-2 border border-roast/40 bg-roast/10 px-3 py-2 text-xs text-orange-200">
      <span aria-hidden>{ICONS[theme.id].error}</span><span className="flex-1">{text}</span>
      {onRetry ? <PressButton onClick={onRetry} className="t-btn border border-roast/40 px-2 py-0.5">Retry</PressButton> : null}
    </motion.div>
  );
}

/* ------------------------------ modal ------------------------------ */
export function ThemedModal({ open, title, body, confirm, cancel = "Cancel", danger, onConfirm, onClose }: {
  open: boolean; title: string; body?: string; confirm: string; cancel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const { theme, haptic } = useTheme();
  const enter: Record<ThemeId, { initial: TargetAndTransition; animate: TargetAndTransition }> = {
    savage: { initial: { opacity: 0, scale: 0.92 }, animate: { opacity: 1, scale: 1 } },
    nature: { initial: { opacity: 0, scale: 0.6, rotate: -6 }, animate: { opacity: 1, scale: 1, rotate: 0 } },
    dogs: { initial: { opacity: 0, y: 200 }, animate: { opacity: 1, y: 0 } },
    horses: { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } },
    cosmic: { initial: { opacity: 0, scale: 1.2, filter: "blur(10px)" }, animate: { opacity: 1, scale: 1, filter: "blur(0px)" } },
    mountains: { initial: { opacity: 0, y: -40 }, animate: { opacity: 1, y: 0 } },
    mani: { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } },
    calm: { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } },
  };
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [open, onClose]);
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[60] grid place-items-end bg-black/50 p-4 sm:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={title} {...enter[theme.id]} exit={{ opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}
            onClick={(e) => e.stopPropagation()} className="t-bubble-bot w-full max-w-sm border p-5 shadow-2xl">
            <p className="font-serif text-lg">{title}</p>
            {body ? <p className="mt-1 text-sm text-white/60">{body}</p> : null}
            <div className="mt-4 flex gap-2">
              <PressButton onClick={onClose} className="t-btn flex-1 border border-white/15 py-2.5 text-sm">{cancel}</PressButton>
              <PressButton onClick={() => { haptic(danger ? "error" : "send"); onConfirm(); }} className={`t-btn flex-1 py-2.5 text-sm ${danger ? "bg-roast text-ink" : "bg-cyan text-ink"}`}>{confirm}</PressButton>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
