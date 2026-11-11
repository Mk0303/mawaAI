"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BackHeader } from "./BackHeader";
import { ThemePicker } from "./theme/ThemePicker";
import { SendGamesSettings } from "./sendgames/SendGamesSettings";
import { EmptyState, PressButton, ThemedModal } from "./theme/parts";

type Imp = { id: string; source: "chatgpt" | "gemini"; createdAt: number; convCount: number; msgCount: number };

export function DataScreen() {
  const [imports, setImports] = useState<Imp[] | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch("/api/import");
    if (r.ok) { const j = await r.json(); setImports(j.imports); setProfile(j.profile); }
  };
  useEffect(() => { void load(); }, []);

  const del = async (id: string | "all") => {
    const r = await fetch(id === "all" ? "/api/import" : `/api/import?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setConfirm(null);
    setMsg(r.ok ? "Deleted. I've already forgotten. Mostly." : "Couldn't delete that. Try again.");
    await load();
  };

  return (
    <main className="mx-auto min-h-dvh max-w-xl">
      <BackHeader title="Settings" />
      <div className="flex flex-col gap-5 px-4 pb-10">
        <ThemePicker />
        <SendGamesSettings />
        <section className="t-card border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">What I know about you</p>
          <p className="mt-2 text-sm leading-relaxed text-white/80">{profile ?? "Nothing yet. Import your old chats and I'll get to know you."}</p>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Imported history</p>
            <Link href="/import" className="text-xs text-cyan">+ Import more</Link>
          </div>
          {imports === null ? <p className="text-sm text-white/40">Loading…</p> : imports.length === 0 ? <EmptyState text="No imports yet." /> : (
            <ul className="flex flex-col gap-2">
              {imports.map((i) => (
                <li key={i.id} className="t-card flex items-center gap-3 border border-white/10 bg-white/[0.03] p-3">
                  <span className={`rounded px-2 py-1 text-[11px] ${i.source === "chatgpt" ? "bg-emerald-400/15 text-emerald-200" : "bg-sky-400/15 text-sky-200"}`}>{i.source === "chatgpt" ? "ChatGPT" : "Gemini"}</span>
                  <div className="flex-1 text-sm"><p>{i.convCount} chats · {i.msgCount} messages</p><p className="text-xs text-white/40">{new Date(i.createdAt).toLocaleString()}</p></div>
                  <PressButton onClick={() => setConfirm(i.id)} className="t-btn border border-roast/40 px-3 py-1.5 text-xs text-orange-200">Delete</PressButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        {imports && imports.length > 0 ? (
          <section className="t-card border border-roast/30 bg-roast/5 p-4">
            <p className="font-medium">Delete all imported data</p>
            <p className="mt-1 text-xs text-white/50">Removes every imported chat, the memory built from them, and your &quot;about you&quot; profile. Your Mawa chats stay.</p>
            <PressButton onClick={() => setConfirm("all")} className="t-btn mt-3 w-full border border-roast/50 py-2.5 text-sm text-orange-200">Delete all imported data</PressButton>
          </section>
        ) : null}
        {msg ? <p className="text-center text-sm text-cyan">{msg}</p> : null}
        <ThemedModal open={confirm !== null} danger
          title={confirm === "all" ? "Delete everything imported?" : "Delete this import?"}
          body={confirm === "all" ? "Every imported chat, its memory, and your profile. Your Mawa chats stay." : "Its chats and the memory built from them."}
          confirm={confirm === "all" ? "Delete everything" : "Yes, delete"}
          onConfirm={() => { if (confirm) void del(confirm); }} onClose={() => setConfirm(null)} />
      </div>
    </main>
  );
}
