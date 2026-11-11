"use client";
import type { ThemeId } from "@/lib/themes/ids";
import { useTheme } from "./ThemeProvider";

/** Deterministic pseudo-random so server and client render the same layer. */
const rnd = (i: number, salt = 1) => { const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };
const css = (o: Record<string, string | number>) => o as React.CSSProperties;
/** Round so server-rendered style strings match what the browser normalises (avoids hydration diffs). */
const f = (n: number) => Math.round(n * 100) / 100;

function Savage() {
  return <div className="absolute inset-x-0 top-0 h-64 opacity-60" style={{ background: "radial-gradient(400px 160px at 50% 0%, var(--t-glow), transparent 70%)" }} />;
}

const Leaf = ({ c }: { c: string }) => (
  <svg viewBox="0 0 24 24" className="h-full w-full"><path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16Z" fill={c} /><path d="M4 20 15 9" stroke="rgba(0,0,0,0.25)" strokeWidth="1.2" /></svg>
);
function Nature() {
  const colors = ["#7cd38a", "#4f9d5c", "#c9a46a", "#a7c957", "#e07a3a"];
  return (
    <>
      <svg className="absolute bottom-0 left-0 w-full opacity-40" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden>
        <path d="M0 120V70c30-20 50 10 80-5s40-35 80-20 50 30 90 10 60-25 100-5 50 10 50 10v60Z" fill="#0f2b1a" />
        <path d="M0 120V90c40-15 70 10 110-2s60-20 100-5 70 15 110 0 80 5 80 5v32Z" fill="#143820" />
      </svg>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="anim-drift-down absolute top-0 opacity-50"
          style={css({ left: `${f(rnd(i) * 100)}%`, width: f(10 + rnd(i, 2) * 12), height: f(10 + rnd(i, 2) * 12), animationDuration: `${f(16 + rnd(i, 3) * 18)}s`, animationDelay: `-${f(rnd(i, 4) * 30)}s`, "--dx": `${f((rnd(i, 5) - 0.5) * 160)}px`, "--rot": `${f(200 + rnd(i, 6) * 300)}deg` })}>
          <Leaf c={colors[i % colors.length]!} />
        </span>
      ))}
    </>
  );
}

const Paw = ({ c }: { c: string }) => (
  <svg viewBox="0 0 32 32" className="h-full w-full"><g fill={c}><ellipse cx="16" cy="21" rx="7" ry="6" /><circle cx="8" cy="13" r="3" /><circle cx="13" cy="8" r="3" /><circle cx="19" cy="8" r="3" /><circle cx="24" cy="13" r="3" /></g></svg>
);
function Dogs() {
  // A trail of paw prints that walks diagonally across, each print fading in turn.
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="anim-paw absolute h-6 w-6"
          style={css({ left: `${f(8 + i * 9)}%`, top: `${f(70 - i * 6 + (i % 2 ? 3 : -3))}%`, transform: `rotate(${f(35 + (i % 2 ? 12 : -12))}deg)`, animationDelay: `${i * 0.5}s` })}>
          <Paw c="rgba(240,123,46,0.22)" />
        </span>
      ))}
      <span className="absolute -right-6 top-24 h-28 w-28 rotate-12 opacity-[0.07]"><Paw c="#3d2a1c" /></span>
    </>
  );
}

function HorseSilhouette() {
  return (
    <svg viewBox="0 0 120 70" className="h-full w-full" aria-hidden>
      <path fill="currentColor" d="M18 40c4-8 14-12 26-12h26c6 0 10-3 14-8l6-8c2-2 5-3 7-1l3 3 5 1c2 1 2 3 0 4l-6 2c-2 1-3 3-3 5v6c0 4-2 8-6 10l-2 8 6 12h-5l-6-11-4-6H50l-6 7 2 10h-5l-2-12 1-7c-6-1-10 0-14 4l-5 15h-5l4-16c-2-2-3-4-2-6Z" />
      <path fill="currentColor" d="M18 40c-6 0-10 4-14 10 4-2 8-3 12-2Z" />
    </svg>
  );
}
function Horses() {
  return (
    <>
      <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: "linear-gradient(to top, rgba(139,90,43,0.22), transparent)" }} />
      <div className="absolute bottom-[14%] left-0 h-12 w-20 text-[#8b5a2b] opacity-[0.22]">
        <div className="anim-gallop h-full w-full"><div className="anim-bob h-full w-full"><HorseSilhouette /></div></div>
      </div>
      <svg className="absolute inset-x-0 top-0 h-16 w-full opacity-20" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden>
        <path d="M0 10H400M0 16H400" stroke="#8b5a2b" strokeWidth="0.6" strokeDasharray="2 4" />
      </svg>
    </>
  );
}

function Cosmic() {
  const stars = Array.from({ length: 46 }, (_, i) => ({ x: rnd(i) * 100, y: rnd(i, 2) * 100, s: rnd(i, 3) < 0.15 ? 2.5 : 1.3, d: 2 + rnd(i, 4) * 4, delay: rnd(i, 5) * 5 }));
  const constellation = [[12, 18], [22, 12], [30, 20], [27, 30], [40, 26]];
  return (
    <>
      {stars.map((s, i) => (
        <span key={i} className="anim-twinkle absolute rounded-full bg-white" style={css({ left: `${f(s.x)}%`, top: `${f(s.y)}%`, width: s.s, height: s.s, animationDuration: `${f(s.d)}s`, animationDelay: `${f(s.delay)}s`, backgroundColor: "#e8eeff" })} />
      ))}
      <svg className="absolute right-0 top-10 h-44 w-44 opacity-40" viewBox="0 0 50 40" aria-hidden>
        <polyline points={constellation.map((p) => p.join(",")).join(" ")} fill="none" stroke="#4ea9ff" strokeWidth="0.3" />
        {constellation.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.9" fill="#d2e7ff" />)}
      </svg>
      <span className="anim-shoot absolute right-[-10vw] top-[8%] h-[2px] w-24 rounded-full" style={{ background: "linear-gradient(90deg, #fff, transparent)", transform: "rotate(-25deg)" }} />
      <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full opacity-30" style={{ background: "radial-gradient(circle at 35% 35%, #6d7bff, #1a1f6b 60%, transparent 70%)" }} />
    </>
  );
}

function Ridge({ d, fill, speed }: { d: string; fill: string; speed: number }) {
  // Two copies side by side so the drift loops seamlessly; slower = farther away (parallax).
  return (
    <div className="absolute inset-x-0 bottom-0 h-full overflow-hidden">
      <div className="anim-drift-x-slow flex h-full w-[200%]" style={{ animationDuration: `${speed}s` }}>
        {[0, 1].map((k) => <svg key={k} viewBox="0 0 400 100" preserveAspectRatio="none" className="h-full w-1/2"><path d={d} fill={fill} /></svg>)}
      </div>
    </div>
  );
}
function Mountains() {
  return (
    <>
      <div className="absolute bottom-0 inset-x-0 h-[46%]">
        <div className="absolute inset-x-0 bottom-0 h-full opacity-40"><Ridge speed={240} fill="#3b4d65" d="M0 100V55L40 30l30 18 40-38 35 30 30-12 45 35 40-28 50 30 40-20 50 25 40-15v100Z" /></div>
        {/* snow caps on the far ridge */}
        <div className="absolute inset-x-0 bottom-0 h-[70%] opacity-60"><Ridge speed={160} fill="#2c3b50" d="M0 100V60l50-35 30 20 45-40 40 35 35-15 50 40 45-30 45 28 60-22v119Z" /></div>
        <div className="absolute inset-x-0 bottom-0 h-[40%] opacity-80"><Ridge speed={90} fill="#1c2735" d="M0 100V50l60-25 50 20 60-30 50 25 70-20 60 25 50-10v85Z" /></div>
      </div>
      {[0, 1, 2].map((i) => (
        <span key={i} className="anim-drift-x absolute h-10 rounded-full blur-md"
          style={css({ top: `${f(14 + i * 13)}%`, width: `${f(120 + i * 50)}px`, animationDuration: `${f(70 + i * 25)}s`, animationDelay: `-${i * 22}s`, backgroundColor: "rgba(220,235,250,0.16)" })} />
      ))}
    </>
  );
}

/* Mani Mode: gold constellation line-art of the things he loves, plus a drifting paraglider. */
const GOLD = "#d6ab52";
function Constellation({ pts, x, y, s = 1, lines }: { pts: [number, number][]; x: string; y: string; s?: number; lines?: [number, number][] }) {
  const segs = lines ?? pts.slice(1).map((_, i) => [i, i + 1] as [number, number]);
  return (
    <svg className="absolute overflow-visible" style={{ left: x, top: y, width: 80 * s, height: 80 * s }} viewBox="0 0 80 80" aria-hidden>
      {segs.map(([a, b], i) => <line key={i} x1={pts[a]![0]} y1={pts[a]![1]} x2={pts[b]![0]} y2={pts[b]![1]} stroke={GOLD} strokeWidth="0.7" opacity="0.55" className="mani-line" />)}
      {pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={i % 2 ? 1.1 : 1.6} fill="#f3dfae" className="anim-twinkle" style={{ animationDuration: `${f(2 + (i % 4))}s` }} />)}
    </svg>
  );
}
function Paraglider({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 60 50" className={className} style={style} aria-hidden>
      <path d="M4 16 Q30 -4 56 16 Q30 8 4 16Z" fill="none" stroke={GOLD} strokeWidth="1.4" />
      <path d="M4 16 L30 40 M56 16 L30 40 M18 9 L30 40 M42 9 L30 40" stroke={GOLD} strokeWidth="0.6" opacity="0.8" />
      <circle cx="30" cy="42" r="2.6" fill={GOLD} />
    </svg>
  );
}
function Mani() {
  const stars = Array.from({ length: 34 }, (_, i) => ({ x: rnd(i, 9) * 100, y: 18 + rnd(i, 10) * 82, d: 2 + rnd(i, 11) * 4 }));
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-40 opacity-50" style={{ background: "radial-gradient(60% 80% at 30% 0%, rgba(255,170,90,0.45), transparent 70%)" }} />
      {stars.map((s, i) => <span key={i} className="anim-twinkle absolute h-[1.5px] w-[1.5px] rounded-full" style={css({ left: `${f(s.x)}%`, top: `${f(s.y)}%`, animationDuration: `${f(s.d)}s`, backgroundColor: "#f3dfae" })} />)}
      {/* cricket bat */}
      <Constellation x="6%" y="20%" s={0.9} pts={[[10, 70], [22, 58], [52, 28], [60, 20], [66, 26], [58, 34], [28, 64]]} lines={[[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 2], [1, 6], [6, 5]]} />
      {/* chess knight */}
      <Constellation x="8%" y="40%" s={0.7} pts={[[20, 70], [60, 70], [56, 52], [62, 34], [48, 14], [28, 24], [36, 36], [26, 46], [34, 52], [20, 70]]} />
      {/* horse */}
      <Constellation x="48%" y="34%" s={1.1} pts={[[10, 40], [26, 30], [34, 14], [42, 18], [40, 30], [58, 34], [66, 50], [60, 72], [52, 52], [30, 52], [22, 72]]} />
      {/* motorcycle */}
      <Constellation x="70%" y="44%" s={0.8} pts={[[14, 56], [26, 44], [44, 44], [54, 34], [66, 56], [44, 56], [26, 44]]} />
      {/* surfboard */}
      <Constellation x="10%" y="58%" s={0.8} pts={[[12, 70], [30, 40], [50, 14], [56, 22], [40, 52], [12, 70]]} />
      <Paraglider className="anim-glide absolute top-[26%] h-8 w-10 opacity-70" style={{ animationDuration: "60s" }} />
      {/* Full Roast: one sweep of the paraglider silhouette across the stars */}
      <Paraglider className="mani-sweep absolute left-0 top-[30%] hidden h-14 w-16 opacity-0" />
    </>
  );
}

/* Calm: a still grey-blue field, two soft haze patches, a faint horizon. */
function Calm() {
  return (
    <>
      <span className="anim-haze pointer-events-none absolute -left-[10%] top-[8%] h-[46%] w-[70%] rounded-full blur-3xl"
        style={{ background: "radial-gradient(ellipse at 40% 40%, rgba(138,163,154,0.10), transparent 70%)", animationDuration: "22s" }} />
      <span className="anim-haze pointer-events-none absolute right-[-16%] bottom-[6%] h-[40%] w-[60%] rounded-full blur-3xl"
        style={{ background: "radial-gradient(ellipse at 60% 60%, rgba(196,184,165,0.08), transparent 70%)", animationDuration: "28s", animationDelay: "-8s" }} />
      <svg className="absolute inset-x-0 bottom-[18%] h-px w-full opacity-25" viewBox="0 0 400 1" preserveAspectRatio="none" aria-hidden>
        <line x1="24" y1="0.5" x2="376" y2="0.5" stroke="var(--t-line)" strokeWidth="1" />
      </svg>
    </>
  );
}

export const BACKGROUNDS: Record<ThemeId, () => React.ReactElement> = { savage: Savage, nature: Nature, dogs: Dogs, horses: Horses, cosmic: Cosmic, mountains: Mountains, mani: Mani, calm: Calm };

export function ThemeBackground({ themeId }: { themeId?: ThemeId }) {
  const { theme } = useTheme();
  const Bg = BACKGROUNDS[themeId ?? theme.id];
  return <div aria-hidden className={`pointer-events-none ${themeId ? "absolute" : "fixed"} inset-0 z-0 overflow-hidden`}><Bg /></div>;
}
