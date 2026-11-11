"use client";
import { useEffect, useState } from "react";
import { GAMES, GAME_IDS, THEME_FLAVOR, parseSendGames, DEFAULT_SEND_GAMES, type GameId, type SendGameMode, type SendGameSettings } from "@/lib/sendgames/games";
import { useTheme } from "../theme/ThemeProvider";
import { PressButton } from "../theme/parts";

const MODES: { id: SendGameMode; label: string; sub: string }[] = [
  { id: "surprise", label: "Surprise me", sub: "A different game each send" },
  { id: "favorites", label: "Favorites", sub: "Only the ones you pick" },
  { id: "fixed", label: "One game", sub: "Always the same" },
  { id: "off", label: "Off", sub: "Plain tap to send" },
];

export function SendGamesSettings() {
  const { theme } = useTheme();
  const [s, setS] = useState<SendGameSettings>(DEFAULT_SEND_GAMES);
  useEffect(() => { void fetch("/api/settings").then(async (r) => { if (r.ok) setS(parseSendGames((await r.json()).sendGames)); }); }, []);
  const save = (n: SendGameSettings) => {
    setS(n);
    void fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ sendGames: n }) });
  };
  const flavor = new Set(THEME_FLAVOR[theme.id]);
  const toggleFav = (g: GameId) => save({ ...s, favorites: s.favorites.includes(g) ? s.favorites.filter((x) => x !== g) : [...s.favorites, g] });
  return (
    <section id="send-games" className="t-card border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Send games</p>
      <p className="mt-1 text-xs text-white/50">Flick, pull, spin or hold the Send button for a tiny game. Enter and quick taps always send right away, and misses still send.</p>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Send game mode">
        {MODES.map((m) => (
          <PressButton key={m.id} role="radio" aria-checked={s.mode === m.id} onClick={() => save({ ...s, mode: m.id, fixed: m.id === "fixed" ? s.fixed ?? THEME_FLAVOR[theme.id][0]! : s.fixed })}
            className={`t-chip border px-3 py-2 text-left ${s.mode === m.id ? "border-cyan bg-cyan/10" : "border-white/10"}`}>
            <span className="block text-sm">{m.label}</span><span className="block text-[11px] text-white/45">{m.sub}</span>
          </PressButton>
        ))}
      </div>
      {s.mode === "favorites" || s.mode === "fixed" ? (
        <div className="mt-3 flex flex-wrap gap-1.5" role={s.mode === "fixed" ? "radiogroup" : "group"} aria-label="Games">
          {GAME_IDS.map((g) => {
            const on = s.mode === "fixed" ? s.fixed === g : s.favorites.includes(g);
            return (
              <PressButton key={g} role={s.mode === "fixed" ? "radio" : "checkbox"} aria-checked={on}
                onClick={() => (s.mode === "fixed" ? save({ ...s, fixed: g }) : toggleFav(g))}
                className={`t-chip border px-2.5 py-1 text-xs ${on ? "border-cyan bg-cyan/15 text-cyan-100" : "border-white/10 text-white/70"}`}>
                {GAMES[g].name}{flavor.has(g) ? <span className="ml-1 text-gold">·</span> : null}
              </PressButton>
            );
          })}
        </div>
      ) : null}
      {s.mode === "surprise" ? <p className="mt-3 text-[11px] text-white/40">Leans toward {THEME_FLAVOR[theme.id].map((g) => GAMES[g].name.toLowerCase()).join(", ")} in {theme.name}. Never the same game 3 sends in a row.</p> : null}
    </section>
  );
}
