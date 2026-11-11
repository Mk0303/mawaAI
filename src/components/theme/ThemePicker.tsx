"use client";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { THEMES, THEME_IDS } from "@/lib/themes/contract";
import { Avatar } from "../Avatar";
import { ThemeBackground } from "./Backgrounds";
import { useTheme } from "./ThemeProvider";
import { EmptyState, PressButton, ThemedProgress, ThemedSlider, ThemedToggle, TypingIndicator } from "./parts";

/** Theme cards render inside their own data-theme scope, so each card is a true live preview. */
export function ThemePicker() {
  const { theme, setTheme, haptic } = useTheme();
  const router = useRouter();
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (leave.current) clearTimeout(leave.current); }, []);
  // After a pick, let the theme ripple play, then return to the chat.
  const pick = (id: (typeof THEME_IDS)[number], at: { x: number; y: number }) => {
    haptic("tap"); setTheme(id, at);
    if (leave.current) clearTimeout(leave.current);
    leave.current = setTimeout(() => router.push("/"), 650);
  };
  return (
    <section id="themes" className="scroll-mt-20">
      <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/40">Themes</p>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Theme">
        {THEME_IDS.map((id) => {
          const t = THEMES[id];
          const active = theme.id === id;
          return (
            <motion.button key={id} role="radio" aria-checked={active} aria-label={`${t.name} theme`} data-theme={id}
              whileTap={{ scale: 0.95 }} onClick={(e) => pick(id, { x: e.clientX, y: e.clientY })}
              className={`t-card relative h-44 overflow-hidden border text-left ${active ? "border-cyan ring-2 ring-cyan/60" : "border-line"}`}
              style={{ background: "var(--t-bg), var(--t-ink)", color: "var(--t-fg)" }}>
              <ThemeBackground themeId={id} />
              <div className="relative flex h-full flex-col p-3">
                <div className="flex items-start justify-between">
                  <Avatar themeId={id} mood={active ? "flex" : "idle"} size={52} />
                  {active ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="t-btn grid h-6 w-6 place-items-center bg-cyan text-xs text-ink">✓</motion.span> : null}
                </div>
                <div className="t-bubble-bot mt-2 self-start border px-2.5 py-1.5 text-[11px] leading-snug">
                  <TypingIndicator themeId={id} />
                </div>
                <div className="mt-auto">
                  <p className="font-serif text-[15px] leading-tight">{t.emoji} {t.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug opacity-60">{t.tagline}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
      <ComponentPreview />
    </section>
  );
}

/** The active theme's controls, live: so you can feel the toggle, slider and loader before chatting. */
export function ComponentPreview() {
  const { theme } = useTheme();
  const [on, setOn] = useState(true);
  const [heat, setHeat] = useState(1);
  const [pct, setPct] = useState(62);
  return (
    <motion.div key={theme.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="t-card mt-4 flex flex-col gap-4 border border-white/10 bg-panel/70 p-4 backdrop-blur" data-testid="theme-preview">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{theme.name} preview</p>
      <div className="flex items-center justify-between"><span className="text-sm">Mawa mode</span><ThemedToggle on={on} onChange={setOn} label="Preview toggle" /></div>
      <ThemedSlider label="Preview heat" steps={3} value={heat} onChange={setHeat} labels={["Chill", "Sarcastic", "Full Roast"]} />
      <div onClick={() => setPct((p) => (p >= 100 ? 10 : p + 15))}><ThemedProgress pct={pct} label="Preview progress" /></div>
      <div className="flex flex-wrap items-center gap-2">
        <PressButton className="t-chip border border-roast/40 bg-roast/10 px-3 py-1.5 text-xs text-orange-200">Roast harder</PressButton>
        <PressButton className="t-btn bg-cyan px-4 py-1.5 text-xs text-ink">Primary</PressButton>
        <span className="t-bubble-bot border px-3 py-1.5"><TypingIndicator /></span>
      </div>
      <EmptyState compact text={theme.copy.emptyChats} />
    </motion.div>
  );
}
