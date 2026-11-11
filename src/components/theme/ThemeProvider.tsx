"use client";
import { MotionConfig } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { THEMES, type ThemeDef, type ThemeId } from "@/lib/themes/contract";
import { isThemeId } from "@/lib/themes/ids";

type Haptic = keyof ThemeDef["haptics"];
interface Ctx { theme: ThemeDef; setTheme: (id: ThemeId, origin?: { x: number; y: number }, persist?: boolean) => void; haptic: (k: Haptic) => void }
const ThemeCtx = createContext<Ctx | null>(null);

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function applyToDocument(id: ThemeId) {
  const el = document.documentElement;
  el.dataset.theme = id;
  el.style.colorScheme = THEMES[id].light ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMES[id].metaColor);
}

/** Holds the active theme; the server renders data-theme on <html> so there is no flash. */
export function ThemeProvider({ initial, children }: { initial: ThemeId; children: React.ReactNode }) {
  const [id, setId] = useState<ThemeId>(initial);
  const theme = THEMES[id];

  const setTheme = useCallback((next: ThemeId, origin?: { x: number; y: number }, persist = true) => {
    if (!isThemeId(next)) return;
    const swap = () => { applyToDocument(next); setId(next); };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !prefersReducedMotion()) {
      if (origin) {
        document.documentElement.style.setProperty("--vt-x", `${origin.x}px`);
        document.documentElement.style.setProperty("--vt-y", `${origin.y}px`);
      }
      doc.startViewTransition(swap);
    } else swap();
    if (persist) {
      void fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: next }) }).catch(() => undefined);
    }
  }, []);

  const haptic = useCallback((k: Haptic) => {
    if (prefersReducedMotion()) return;
    try { navigator.vibrate?.(THEMES[id].haptics[k]); } catch { /* not supported */ }
  }, [id]);

  useEffect(() => { applyToDocument(id); }, [id]);
  const value = useMemo(() => ({ theme, setTheme, haptic }), [theme, setTheme, haptic]);
  // reducedMotion="user": Framer Motion skips transform animations when the OS asks it to.
  return <ThemeCtx.Provider value={value}><MotionConfig reducedMotion="user">{children}</MotionConfig></ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const c = useContext(ThemeCtx);
  if (!c) return { theme: THEMES.savage, setTheme: () => undefined, haptic: () => undefined };
  return c;
}
