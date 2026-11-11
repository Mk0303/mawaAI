"use client";
import { AnimatePresence, motion } from "framer-motion";
import type { ThemeId } from "@/lib/themes/ids";
import { useTheme } from "./theme/ThemeProvider";

export type AvatarMood = "idle" | "thinking" | "chill" | "smug" | "roast" | "flex" | "care";

const GLOW: Record<AvatarMood, string> = {
  idle: "var(--t-accent)", thinking: "var(--t-accent)", chill: "var(--t-accent)", smug: "var(--t-accent)",
  roast: "var(--t-roast)", flex: "var(--t-gold)", care: "var(--t-care)",
};

/** Eyes + mouth per mood in a 100x100 box. Shared by every avatar; each one places and colours it. */
function Face({ mood, color, mouth = true }: { mood: AvatarMood; color: string; mouth?: boolean }) {
  const s = { fill: color } as const;
  const line = { stroke: color, strokeWidth: 3.5, strokeLinecap: "round" as const, fill: "none" };
  switch (mood) {
    case "smug": // side-eye
      return (<g>
        <rect x="27" y="40" width="17" height="12" rx="6" {...s} />
        <rect x="56" y="45" width="17" height="6" rx="3" {...s} />
        {mouth ? <path d="M46 66 Q58 70 68 61" {...line} /> : null}
      </g>);
    case "roast":
      return (<g>
        <path d="M26 40 L44 46 L44 52 L28 50 Z" {...s} />
        <path d="M74 40 L56 46 L56 52 L72 50 Z" {...s} />
        {mouth ? <path d="M34 62 Q50 78 66 62 Z" fill={color} opacity="0.9" /> : null}
      </g>);
    case "flex":
      return (<g>
        <path d="M27 50 Q35 38 43 50" {...line} strokeWidth={5} />
        <path d="M57 50 Q65 38 73 50" {...line} strokeWidth={5} />
        {mouth ? <path d="M38 63 Q50 72 62 63" {...line} /> : null}
      </g>);
    case "care":
      return (<g>
        <path d="M28 47 Q35 53 42 47" {...line} />
        <path d="M58 47 Q65 53 72 47" {...line} />
        {mouth ? <path d="M43 64 Q50 68 57 64" {...line} /> : null}
      </g>);
    case "chill":
      return (<g>
        <rect x="28" y="46" width="16" height="5" rx="2.5" {...s} />
        <rect x="56" y="46" width="16" height="5" rx="2.5" {...s} />
        {mouth ? <path d="M44 64 L58 64" {...line} /> : null}
      </g>);
    case "thinking":
      return (<g>
        <motion.circle cx="36" cy="47" r="6" {...s} animate={{ cx: [36, 40, 36] }} transition={{ repeat: Infinity, duration: 1.4 }} />
        <motion.circle cx="64" cy="47" r="6" {...s} animate={{ cx: [64, 68, 64] }} transition={{ repeat: Infinity, duration: 1.4 }} />
        {mouth ? <motion.path d="M44 65 L56 65" {...line} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2 }} /> : null}
      </g>);
    default:
      return (<motion.g animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ repeat: Infinity, duration: 4, times: [0, 0.9, 0.95, 1] }} style={{ originY: "48px" }}>
        <path d="M28 52 Q36 40 44 52" {...line} strokeWidth={6} />
        <path d="M56 52 Q64 40 72 52" {...line} strokeWidth={6} />
      </motion.g>);
  }
}

const loop = (duration: number) => ({ repeat: Infinity, duration, ease: "easeInOut" as const });
type P = { mood: AvatarMood; color: string };

function FaceSwap({ mood, color, mouth, transform }: { mood: AvatarMood; color: string; mouth?: boolean; transform?: string }) {
  return (
    <g transform={transform}>
      <AnimatePresence mode="wait">
        <motion.g key={mood} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }} style={{ originX: "50px", originY: "50px" }}>
          <Face mood={mood} color={color} mouth={mouth} />
        </motion.g>
      </AnimatePresence>
    </g>
  );
}

/* ---------- Savage Dark: neon orb ---------- */
function Orb({ mood, color }: P) {
  return (<>
    <defs>
      <radialGradient id="av-orb" cx="40%" cy="30%" r="75%"><stop offset="0%" stopColor="#1c2638" /><stop offset="70%" stopColor="#090d16" /><stop offset="100%" stopColor="#05070d" /></radialGradient>
    </defs>
    <motion.circle cx="50" cy="50" r="46" fill="url(#av-orb)" strokeWidth="1.5" animate={{ stroke: color }} transition={{ duration: 0.5 }} />
    <FaceSwap mood={mood} color={color} />
  </>);
}

/* ---------- Nature: a leafy sprout spirit ---------- */
function Sprout({ mood, color }: P) {
  const sway = mood === "roast" ? { rotate: [0, -18, 14, -10, 0] } : mood === "flex" ? { rotate: [0, 14, -14, 0], scale: [1, 1.15, 1] } : { rotate: [-6, 6, -6] };
  return (<>
    <defs><radialGradient id="av-seed" cx="40%" cy="35%" r="70%"><stop offset="0%" stopColor="#3f8a52" /><stop offset="100%" stopColor="#12321d" /></radialGradient></defs>
    <motion.g style={{ originX: "50px", originY: "22px" }} animate={sway} transition={mood === "roast" || mood === "flex" ? { duration: 0.7 } : loop(3.5)}>
      <path d="M50 22 C38 4 22 8 20 14 C30 22 42 24 50 22Z" fill="#7cd38a" />
      <path d="M50 22 C60 2 80 6 82 12 C72 22 60 24 50 22Z" fill="#a7c957" />
      <path d="M50 28 V18" stroke="#2f6b3c" strokeWidth="3" strokeLinecap="round" />
    </motion.g>
    <path d="M50 24 C78 24 92 46 90 64 C88 84 70 94 50 94 C30 94 12 84 10 64 C8 46 22 24 50 24Z" fill="url(#av-seed)" stroke={color} strokeWidth="1.5" />
    {mood === "care" ? <circle cx="50" cy="60" r="34" fill="#9ed8c3" opacity="0.12" /> : null}
    <FaceSwap mood={mood} color="#e8f2e2" transform="translate(0 10)" />
    <circle cx="26" cy="70" r="4" fill="#e07a3a" opacity="0.35" /><circle cx="74" cy="70" r="4" fill="#e07a3a" opacity="0.35" />
  </>);
}

/* ---------- Dogs: floppy-eared pup ---------- */
function Pup({ mood }: P) {
  const ears = mood === "flex" ? { rotate: [0, -25, 0, -25, 0] } : mood === "roast" ? { rotate: [0, 10, 10] } : mood === "thinking" ? { rotate: [0, -18, 0] } : { rotate: [0, -6, 0] };
  const earT = mood === "flex" ? { duration: 0.6 } : mood === "roast" ? { duration: 0.3 } : loop(mood === "thinking" ? 1.4 : 2.8);
  const ink = "#3d2a1c";
  return (<>
    {/* tail peeking out, wags hard on flex */}
    <motion.path d="M80 84 Q96 74 92 60" stroke="#c98a4b" strokeWidth="7" strokeLinecap="round" fill="none" style={{ originX: "80px", originY: "84px" }}
      animate={mood === "flex" ? { rotate: [0, 28, -10, 28, -10, 0] } : { rotate: [0, 8, 0] }} transition={mood === "flex" ? { duration: 0.8 } : loop(1.6)} />
    <motion.path d="M24 26 C8 28 6 52 14 64 C20 70 26 60 28 48Z" fill="#8a5a33" style={{ originX: "26px", originY: "28px" }} animate={ears} transition={earT} />
    <motion.path d="M76 26 C92 28 94 52 86 64 C80 70 74 60 72 48Z" fill="#8a5a33" style={{ originX: "74px", originY: "28px" }}
      animate={mood === "flex" ? { rotate: [0, 25, 0, 25, 0] } : mood === "thinking" ? { rotate: 0 } : { rotate: [0, 6, 0] }} transition={earT} />
    <ellipse cx="50" cy="52" rx="32" ry="34" fill="#e0a868" />
    <ellipse cx="62" cy="40" rx="12" ry="10" fill="#f3d2a4" opacity="0.9" />
    <ellipse cx="50" cy="70" rx="17" ry="13" fill="#f6e1c2" />
    <FaceSwap mood={mood} color={ink} mouth={false} transform="translate(0 -4)" />
    <path d="M44 64 Q50 60 56 64 Q50 70 44 64Z" fill={ink} />
    <path d="M50 68 V72 M50 72 Q44 76 40 72 M50 72 Q56 76 60 72" stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    <AnimatePresence>{mood === "flex" || mood === "chill" ? (
      <motion.path key="tongue" d="M47 74 Q50 86 53 74Z" fill="#ef6f7c" initial={{ scaleY: 0 }} animate={{ scaleY: [1, 1.2, 1] }} exit={{ scaleY: 0 }} transition={loop(0.5)} style={{ originY: "74px" }} />
    ) : null}</AnimatePresence>
  </>);
}

/* ---------- Horses: elegant horse head with flowing mane ---------- */
function Steed({ mood }: P) {
  const ink = "#1b120a";
  return (<>
    <motion.g animate={{ x: mood === "flex" ? [0, -2, 0] : [0, -1.5, 0] }} transition={loop(mood === "flex" ? 0.5 : 2.4)}>
      {[0, 1, 2, 3].map((i) => (
        <motion.path key={i} d={`M${60 + i * 4} ${16 + i * 10} q14 6 ${16 - i * 2} 20`} stroke="#3a2412" strokeWidth="6" strokeLinecap="round" fill="none"
          animate={{ rotate: [0, mood === "flex" ? 14 : 6, 0] }} style={{ originX: `${60 + i * 4}px`, originY: `${16 + i * 10}px` }} transition={{ ...loop(mood === "flex" ? 0.45 : 2.2), delay: i * 0.12 }} />
      ))}
    </motion.g>
    <motion.path d="M34 18 L38 4 L44 18Z" fill="#7a4a26" style={{ originX: "40px", originY: "18px" }} animate={mood === "roast" ? { rotate: -25 } : mood === "thinking" ? { rotate: [0, 12, 0] } : { rotate: 0 }} transition={mood === "thinking" ? loop(1.2) : { duration: 0.3 }} />
    <motion.path d="M56 18 L62 4 L66 18Z" fill="#7a4a26" style={{ originX: "60px", originY: "18px" }} animate={mood === "roast" ? { rotate: 25 } : { rotate: 0 }} transition={{ duration: 0.3 }} />
    <path d="M30 22 C30 12 70 12 70 22 L66 70 C64 88 36 88 34 70Z" fill="#8b5a32" stroke="#cfa64e" strokeWidth="1.4" />
    <path d="M47 18 L53 18 L52 60 L48 60Z" fill="#f4e8d2" opacity="0.85" />
    <ellipse cx="50" cy="76" rx="15" ry="11" fill="#6b4226" />
    <circle cx="44" cy="77" r="2.4" fill={ink} /><circle cx="56" cy="77" r="2.4" fill={ink} />
    <FaceSwap mood={mood} color="#f4e8d2" mouth={false} transform="translate(5 -8) scale(0.9)" />
    <path d="M30 40 Q22 50 30 58" stroke="#cfa64e" strokeWidth="1.2" fill="none" opacity="0.7" />
  </>);
}

/* ---------- Cosmic: "Orbi", an original round robo-cat (pointy ears, visor eyes, star antenna) ---------- */
function Orbi({ mood }: P) {
  const eye = mood === "roast" ? "#ff6b8b" : mood === "flex" ? "#ffd447" : "#7fe3ff";
  return (<>
    <motion.g animate={{ rotate: mood === "thinking" ? [0, 12, -12, 0] : [0, 4, 0] }} style={{ originX: "50px", originY: "16px" }} transition={loop(mood === "thinking" ? 1 : 3)}>
      <path d="M50 16 V6" stroke="#bcd6ff" strokeWidth="2" />
      <motion.path d="M50 0 l2 4 4 .6 -3 3 .8 4 -3.8-2 -3.8 2 .8-4 -3-3 4-.6Z" fill="#ffd447" animate={{ scale: mood === "flex" ? [1, 1.6, 1] : [1, 1.15, 1] }} transition={loop(1.2)} style={{ originX: "50px", originY: "6px" }} />
    </motion.g>
    <motion.path d="M18 34 L22 10 L40 22Z" fill="#2f7fe0" style={{ originX: "28px", originY: "26px" }} animate={mood === "roast" ? { rotate: -18 } : { rotate: [0, -6, 0] }} transition={mood === "roast" ? { duration: 0.3 } : loop(2.6)} />
    <motion.path d="M82 34 L78 10 L60 22Z" fill="#2f7fe0" style={{ originX: "72px", originY: "26px" }} animate={mood === "roast" ? { rotate: 18 } : { rotate: [0, 6, 0] }} transition={mood === "roast" ? { duration: 0.3 } : loop(2.6)} />
    <circle cx="50" cy="54" r="40" fill="#3a8ef0" stroke="#bcd6ff" strokeWidth="1.2" />
    <ellipse cx="50" cy="60" rx="30" ry="27" fill="#eaf3ff" />
    <rect x="22" y="38" width="56" height="22" rx="11" fill="#0b1a4a" />
    <g transform="translate(0 2)"><Face mood={mood} color={eye} mouth={false} /></g>
    <path d="M47 66 L53 66 L50 70Z" fill="#ff8fb1" />
    <path d="M44 74 Q50 79 56 74" stroke="#30508f" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    <path d="M28 68 H12 M28 73 L13 77 M72 68 H88 M72 73 L87 77" stroke="#9fb8e6" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="80" cy="82" r="3" fill="#ffd447" opacity="0.8" />
  </>);
}

/* ---------- Mountains: a snowy mountain goat with curled horns ---------- */
function Goat({ mood }: P) {
  const ink = "#1d3247";
  return (<>
    <motion.g animate={mood === "flex" ? { y: [0, -3, 0] } : { y: 0 }} transition={{ duration: 0.5 }}>
      <path d="M36 24 C24 10 10 16 14 30 C18 24 26 24 32 32Z" fill="#9aa9b8" stroke="#6d7f91" strokeWidth="1" />
      <path d="M64 24 C76 10 90 16 86 30 C82 24 74 24 68 32Z" fill="#9aa9b8" stroke="#6d7f91" strokeWidth="1" />
    </motion.g>
    <motion.ellipse cx="18" cy="44" rx="11" ry="5" fill="#e6edf3" style={{ originX: "28px", originY: "44px" }} animate={{ rotate: mood === "roast" ? -20 : [0, -8, 0] }} transition={mood === "roast" ? { duration: 0.3 } : loop(3)} />
    <motion.ellipse cx="82" cy="44" rx="11" ry="5" fill="#e6edf3" style={{ originX: "72px", originY: "44px" }} animate={{ rotate: mood === "roast" ? 20 : [0, 8, 0] }} transition={mood === "roast" ? { duration: 0.3 } : loop(3)} />
    <path d="M28 34 C28 22 72 22 72 34 L68 66 C66 80 34 80 32 66Z" fill="#f7fafc" stroke="#b7c6d4" strokeWidth="1.4" />
    <motion.path d="M42 76 Q50 98 58 76Z" fill="#e2e9f0" style={{ originX: "50px", originY: "76px" }} animate={{ rotate: [-4, 4, -4] }} transition={loop(mood === "flex" ? 0.6 : 2.4)} />
    <ellipse cx="50" cy="68" rx="11" ry="8" fill="#dfe7ee" />
    <circle cx="46" cy="68" r="1.8" fill={ink} /><circle cx="54" cy="68" r="1.8" fill={ink} />
    <FaceSwap mood={mood} color={ink} mouth={false} transform="translate(5 -6) scale(0.9)" />
    {mood === "flex" ? <motion.circle cx="80" cy="14" r="6" fill="#d29b2e" initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} /> : null}
  </>);
}

/* ---------- Mani Mode: "Kite", an original helmeted robot-cat paraglider pilot in a star ring (no bell, no pocket) ---------- */
function Kite({ mood }: P) {
  const ink = "#0a1030";
  const tug = mood === "roast" ? { y: [0, -4, 0] } : { y: 0 };
  return (<>
    {/* star ring */}
    <circle cx="50" cy="52" r="47" fill="#0e1640" stroke="#d6ab52" strokeWidth="1.2" />
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return <motion.circle key={i} cx={Math.round((50 + Math.cos(a) * 47) * 100) / 100} cy={Math.round((52 + Math.sin(a) * 47) * 100) / 100} r={i % 3 ? 0.9 : 1.6} fill="#f3dfae"
        animate={{ opacity: [0.4, 1, 0.4] }} transition={{ ...loop(2.4), delay: i * 0.2 }} />;
    })}
    <motion.g animate={tug} transition={{ duration: 0.3, ease: "easeOut" }}>
      {/* antenna bob */}
      <motion.g animate={{ rotate: [-5, 5, -5] }} style={{ originX: "50px", originY: "20px" }} transition={loop(2.2)}>
        <path d="M50 20 V10" stroke="#d6ab52" strokeWidth="1.6" /><circle cx="50" cy="9" r="2.4" fill="#e9c46c" />
      </motion.g>
      <path d="M22 40 L24 18 L40 28Z" fill="#3f7fd6" /><path d="M78 40 L76 18 L60 28Z" fill="#3f7fd6" />
      <circle cx="50" cy="52" r="30" fill="#4a8be0" />
      {/* helmet: gold-rimmed shell with a centre seam */}
      <path d="M21 46 C22 24 78 24 79 46 C70 40 30 40 21 46Z" fill="#1b2556" stroke="#d6ab52" strokeWidth="1.4" />
      <path d="M50 26 V40" stroke="#d6ab52" strokeWidth="1" opacity="0.7" />
      <ellipse cx="50" cy="61" rx="21" ry="17" fill="#e9f1ff" />
      <g transform="translate(9 9) scale(0.82)"><Face mood={mood} color={ink} mouth={false} /></g>
      {/* eye glint */}
      <motion.circle cx="42" cy="49" r="1.4" fill="#ffffff" animate={{ opacity: [0, 1, 0] }} transition={{ ...loop(3.2), delay: 1 }} />
      <path d="M48 62 L52 62 L50 65Z" fill="#e8843b" />
      <path d={mood === "roast" || mood === "smug" ? "M44 69 Q52 72 57 66" : "M45 68 Q50 72 55 68"} stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* harness straps + buckle */}
      <path d="M30 76 L44 86 M70 76 L56 86" stroke="#8b5a2b" strokeWidth="3.4" strokeLinecap="round" />
      <rect x="45" y="83" width="10" height="7" rx="1.5" fill="#d6ab52" />
    </motion.g>
  </>);
}

/* Calm: a quiet pebble with a thin sand ring. Almost still. */
function Pebble({ mood, color }: P) {
  const face = mood === "roast" || mood === "flex" ? "#e8ebe8" : "#d5d8dc";
  return (<>
    <defs>
      <radialGradient id="av-pebble" cx="42%" cy="32%" r="72%">
        <stop offset="0%" stopColor="#2a3038" /><stop offset="70%" stopColor="#1a1e25" /><stop offset="100%" stopColor="#14171c" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="52" r="38" fill="url(#av-pebble)" stroke={color} strokeWidth="1.2" opacity="0.95" />
    <circle cx="50" cy="52" r="38" fill="none" stroke="#c4b8a5" strokeWidth="0.7" opacity="0.35" />
    <FaceSwap mood={mood} color={face} transform="translate(0 4)" />
  </>);
}

export const AVATARS: Record<ThemeId, (p: P) => React.ReactElement> = { savage: Orb, nature: Sprout, dogs: Pup, horses: Steed, cosmic: Orbi, mountains: Goat, mani: Kite, calm: Pebble };

export function Avatar({ mood, size = 120, themeId }: { mood: AvatarMood; size?: number; themeId?: ThemeId }) {
  const { theme } = useTheme();
  const id = themeId ?? theme.id;
  const Body = AVATARS[id];
  const color = GLOW[mood];
  const aura = id === "calm" ? 0.08 : 0.3;
  return (
    <motion.div
      className="relative select-none"
      style={{ width: size, height: size }}
      animate={mood === "roast" ? { x: [0, -3, 3, -2, 2, 0] } : mood === "flex" ? { scale: [1, 1.06, 1] } : { y: [0, -4, 0] }}
      transition={mood === "roast" ? { duration: 0.45 } : mood === "flex" ? { duration: 0.8 } : { repeat: Infinity, duration: id === "calm" ? 8 : 4, ease: "easeInOut" }}
      aria-label={`Mawa is feeling ${mood}`}
      role="img"
    >
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ backgroundColor: color }}
        animate={{ opacity: mood === "thinking" ? [aura, aura * 2, aura] : aura }}
        transition={{ duration: mood === "thinking" ? 1.4 : 0.6, repeat: mood === "thinking" ? Infinity : 0 }}
      />
      <svg viewBox="0 0 100 100" className="relative h-full w-full overflow-visible"><Body mood={mood} color={color} /></svg>
    </motion.div>
  );
}
