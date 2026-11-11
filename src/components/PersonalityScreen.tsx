"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { BackHeader } from "./BackHeader";
import { PressButton, ThemedSlider, ThemedToggle } from "./theme/parts";

type Vibe = "chill" | "sarcastic" | "full_roast";
const OPTS: { id: Vibe; name: string; mood: "chill" | "smug" | "roast"; sub: string; preview: string; previewMawa: string }[] = [
  { id: "chill", name: "Chill", mood: "chill", sub: "Easygoing. Low heat.", preview: "Sure thing, here you go.", previewMawa: "Sure mawa, idigo." },
  { id: "sarcastic", name: "Sarcastic", mood: "smug", sub: "Witty. Sharp. Side-eye included.", preview: "Bold of you to ask that.", previewMawa: "Bold question ra mawa." },
  { id: "full_roast", name: "Full Roast", mood: "roast", sub: "No filter. Maximum heat.", preview: "It runs. So does a fridge.", previewMawa: "It runs mawa. Fridge kuda run avthundi." },
];

export function PersonalityScreen() {
  const [vibe, setVibe] = useState<Vibe>("sarcastic");
  const [mawa, setMawa] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => { void fetch("/api/settings").then(async (r) => { if (r.ok) { const s = await r.json(); setVibe(s.vibe); setMawa(s.mawa); } }); }, []);

  const save = async (v: Vibe, m: boolean) => {
    setVibe(v); setMawa(m);
    const r = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ vibe: v, mawa: m }) });
    setSaved(r.ok); setTimeout(() => setSaved(false), 1500);
  };
  useEffect(() => { document.documentElement.dataset.vibe = vibe; }, [vibe]);
  const cur = OPTS.find((o) => o.id === vibe)!;
  const idx = OPTS.indexOf(cur);

  return (
    <main className="mx-auto min-h-dvh max-w-xl">
      <BackHeader title="Personality" />
      <div className="px-4">
        <div className="mx-auto mt-6 w-full max-w-sm">
          <p className="mb-1 text-center text-[11px] uppercase tracking-[0.2em] text-white/40">Heat</p>
          <ThemedSlider label="Heat level" steps={3} value={idx} onChange={(i) => void save(OPTS[i]!.id, mawa)} labels={OPTS.map((o) => o.name)} />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Vibe">
          {OPTS.map((o) => (
            <PressButton key={o.id} role="radio" aria-checked={vibe === o.id} onClick={() => void save(o.id, mawa)} className="flex flex-col items-center text-center">
              <motion.div animate={{ scale: vibe === o.id ? 1.12 : 0.88, opacity: vibe === o.id ? 1 : 0.55 }}>
                <Avatar mood={o.mood} size={84} />
              </motion.div>
              <span className="mt-2 font-medium">{o.name}</span>
              <span className="mt-1 text-[11.5px] leading-snug text-white/50">{o.sub}</span>
            </PressButton>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Toggle icon="⚡" title="Mawa mode" sub="Telugu-English mix. Unleash the full personality." on={mawa} onChange={(v) => void save(vibe, v)} />
          <Toggle icon="🛡️" title="Care mode on serious topics" sub="Kinder replies when it matters. Always on." on locked />
        </div>

        <p className="mt-6 text-[11px] uppercase tracking-[0.2em] text-white/40">Preview</p>
        <motion.div key={vibe + String(mawa)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className={`t-bubble-bot mt-2 inline-block border px-4 py-3 font-serif ${vibe === "full_roast" ? "t-mood-roast" : vibe === "sarcastic" ? "t-mood-smug" : ""}`}>
          {mawa ? cur.previewMawa : cur.preview}
        </motion.div>
        <p className="mt-4 h-5 text-xs text-cyan">{saved ? "Saved ✓" : ""}</p>
        <p className="mb-10 text-xs text-white/35">Mawa never jokes about who you are: religion, caste, gender, body, money trouble and the like are off limits, at every heat level.</p>
      </div>
    </main>
  );
}

function Toggle({ icon, title, sub, on, onChange, locked }: { icon: string; title: string; sub: string; on: boolean; onChange?: (v: boolean) => void; locked?: boolean }) {
  return (
    <div className="t-card flex items-center gap-3 border border-white/10 bg-white/[0.03] p-4">
      <span className="t-btn grid h-11 w-11 place-items-center border border-cyan/30 bg-cyan/5 text-lg">{icon}</span>
      <div className="flex-1"><p className="font-medium">{title}</p><p className="text-xs text-white/50">{sub}</p></div>
      <ThemedToggle on={on} onChange={onChange} label={title} locked={locked} />
    </div>
  );
}
