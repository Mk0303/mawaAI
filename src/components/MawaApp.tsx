"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar, type AvatarMood } from "./Avatar";
import { Bubble, type UiAttachment, type UiMessage, type UiMood, type UiSource } from "./Bubble";
import { useRecorder } from "./useRecorder";
import { useTheme } from "./theme/ThemeProvider";
import { EmptyState, PressButton, SendButton, useIcons } from "./theme/parts";
import { NextGameBadge, SendGameLayer, useSendGames } from "./sendgames/SendGameLayer";
import { DEFAULT_SEND_GAMES, parseSendGames, type SendGameSettings } from "@/lib/sendgames/games";
import { RichText } from "./RichText";

type Vibe = "chill" | "sarcastic" | "full_roast";
type Category = "chat" | "code" | "docs" | "image" | "video" | "search";
type SideItem = { id: string; title: string; updatedAt: number; kind: "chat" | "imported"; source?: "chatgpt" | "gemini" };

const CHIPS: { id: Category; label: string; icon: string; tone: string }[] = [
  { id: "chat", label: "Chat", icon: "💬", tone: "border-cyan/40 text-cyan-200" },
  { id: "code", label: "Code", icon: "</>", tone: "border-violet-400/40 text-violet-200" },
  { id: "docs", label: "Docs", icon: "📄", tone: "border-sky-400/40 text-sky-200" },
  { id: "image", label: "Image", icon: "🖼️", tone: "border-fuchsia-400/40 text-fuchsia-200" },
  { id: "video", label: "Video", icon: "▶", tone: "border-gold/40 text-amber-200" },
  { id: "search", label: "Search", icon: "🔍", tone: "border-teal-400/40 text-teal-200" },
];
const VIBES: { id: Vibe; label: string }[] = [{ id: "chill", label: "Chill" }, { id: "sarcastic", label: "Sarcastic" }, { id: "full_roast", label: "Full Roast" }];

export function MawaApp({ userName, devMode }: { userName: string; devMode: boolean }) {
  const { theme, haptic } = useTheme();
  const icons = useIcons();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [imported, setImported] = useState<{ title: string; source: string } | null>(null);
  const [input, setInput] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [vibe, setVibe] = useState<Vibe>("sarcastic");
  const [mawa, setMawa] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<AvatarMood>("idle");
  const [drawer, setDrawer] = useState(false);
  const [side, setSide] = useState<{ threads: SideItem[]; imported: SideItem[] }>({ threads: [], imported: [] });
  const [toast, setToast] = useState<string | null>(null);
  const [sgSettings, setSgSettings] = useState<SendGameSettings>(DEFAULT_SEND_GAMES);
  const sg = useSendGames(sgSettings);
  const [pending, setPending] = useState<(UiAttachment & { uploading?: boolean })[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // Grow the message box with its text (up to ~8 lines), then scroll inside it so nothing is cut off.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = Math.min(220, Math.round(window.innerHeight * 0.4));
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [input]);

  const loadSide = useCallback(async () => {
    const r = await fetch("/api/threads");
    if (r.ok) setSide(await r.json());
  }, []);

  useEffect(() => {
    void loadSide();
    void fetch("/api/settings").then(async (r) => { if (r.ok) { const s = await r.json(); setVibe(s.vibe); setMawa(s.mawa); setSgSettings(parseSendGames(s.sendGames)); } });
  }, [loadSide]);

  useEffect(() => {
    const el = scroller.current; if (!el) return;
    // While a reply streams, follow it instantly (smooth scroll restarting on every token looks like flicker),
    // and only if the reader is already near the bottom.
    if (busy) { if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight; }
    else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  // Some themes (Mani Mode) restyle the sky with the heat level.
  useEffect(() => { document.documentElement.dataset.vibe = vibe; }, [vibe]);

  const saveVibe = async (v: Vibe) => {
    setVibe(v);
    setMood(v === "chill" ? "chill" : v === "sarcastic" ? "smug" : "roast");
    await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ vibe: v, mawa }) });
  };

  const run = async (body: Record<string, unknown>, optimisticUser?: string, userAtts?: UiAttachment[]) => {
    if (busy) return;
    setBusy(true);
    setMood("thinking");
    const aid = "a-" + Math.random().toString(36).slice(2);
    setMessages((ms) => [
      ...(body.regenerate ? (ms.at(-1)?.role === "assistant" ? ms.slice(0, -1) : ms) : ms),
      ...(optimisticUser ? [{ id: "u-" + aid, role: "user" as const, content: optimisticUser, attachments: userAtts }] : []),
      { id: aid, role: "assistant", content: "", streaming: true },
    ]);
    const patch = (p: Partial<UiMessage>) => setMessages((ms) => ms.map((m) => (m.id === aid ? { ...m, ...p } : m)));
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        patch({ content: (j as { error?: string }).error ?? theme.copy.error, streaming: false, mood: "chill" });
        haptic("error");
        setMood("idle");
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let text = "";
      let raf: number | null = null;
      const imgs: UiAttachment[] = [];
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as Record<string, unknown>;
          if (ev.type === "meta") {
            if (typeof ev.threadId === "string") setThreadId(ev.threadId);
            patch({ mood: ev.mood as UiMood });
          } else if (ev.type === "status") {
            patch({ status: ev.text as string });
          } else if (ev.type === "image") {
            imgs.push({ id: ev.id as string, kind: "image_gen" });
            patch({ attachments: [...imgs], status: null });
          } else if (ev.type === "sources") {
            patch({ sources: ev.items as UiSource[], status: null });
          } else if (ev.type === "model") {
            patch({ model: ev.label as string, fallback: ev.fallback as boolean });
          } else if (ev.type === "delta") {
            text += ev.text as string;
            // Paint at most once per frame so fast streams don't re-render on every token.
            if (raf === null) raf = requestAnimationFrame(() => { raf = null; patch({ content: text }); });
          } else if (ev.type === "done") {
            if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
            patch({ content: text });
            const md = ev.mood as UiMood;
            patch({ streaming: false, status: null, model: ev.label as string, ms: ev.ms as number, mood: md });
            setMood((md ?? "idle") as AvatarMood);
          } else if (ev.type === "error") {
            patch({ content: text + "\n\n" + String(ev.message), streaming: false });
          }
        }
      }
      void loadSide();
    } catch {
      if (!ctrl.signal.aborted) { patch({ content: theme.copy.offline, streaming: false }); haptic("error"); }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const ready = pending.filter((p) => !p.uploading);
  const send = async () => {
    const atts = ready;
    const text = input.trim() || (atts.length ? (atts.some((a) => a.kind === "pdf") ? "Summarize this for me." : "What's in this photo?") : "");
    if (!text || busy || imported || pending.some((p) => p.uploading)) return;
    setInput("");
    setPending([]);
    await run({ text, ...(threadId ? { threadId } : {}), ...(category ? { category } : {}), ...(atts.length ? { attachments: atts.map((a) => a.id) } : {}) }, text, atts);
  };

  // Enter and form submit go through the Send button so onFire plays the game,
  // matching a keyboard activation (click with detail === 0).
  const triggerSend = () => {
    const btn = sendBtnRef.current;
    if (btn && !btn.disabled) {
      btn.click();
      return;
    }
    void send();
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files).slice(0, 4 - pending.length)) {
      const tmp = "tmp-" + Math.random().toString(36).slice(2);
      const isImg = f.type.startsWith("image/");
      const preview = isImg ? URL.createObjectURL(f) : undefined;
      setPending((p) => [...p, { id: tmp, kind: isImg ? "photo" : "pdf", name: f.name, preview, uploading: true }]);
      const fd = new FormData();
      fd.append("file", f);
      try {
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((j as { error?: string }).error ?? "Upload failed. Try again.");
        setPending((p) => p.map((x) => (x.id === tmp ? { id: j.id, kind: j.kind, name: j.name, pages: j.pages, preview } : x)));
      } catch (e) {
        setPending((p) => p.filter((x) => x.id !== tmp));
        setToast(e instanceof Error ? e.message : "Upload failed.");
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const onAudio = useCallback(async (blob: Blob) => {
    setTranscribing(true);
    const fd = new FormData();
    fd.append("audio", blob, "voice." + (blob.type.includes("mp4") || blob.type.includes("aac") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm"));
    try {
      const r = await fetch("/api/transcribe", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "Couldn't catch that.");
      const t = String((j as { text?: string }).text ?? "").trim();
      if (!t) throw new Error("I heard silence. Try again?");
      setInput((x) => (x ? x + " " : "") + t);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Couldn't catch that.");
    } finally {
      setTranscribing(false);
    }
  }, []);
  const onRecErr = useCallback((m: string) => setToast(m), []);
  const mic = useRecorder(onAudio, onRecErr);

  const steer = (s: "harder" | "nicer") => {
    if (!threadId || busy) return;
    setToast(s === "harder" ? `${icons.harderLabel} ${icons.harder}` : `${icons.nicerLabel} ${icons.nicer}`);
    void run({ threadId, regenerate: true, steer: s });
  };

  const openThread = async (it: SideItem) => {
    setDrawer(false);
    abort.current?.abort();
    if (it.kind === "imported") {
      const r = await fetch(`/api/imported/${it.id}`);
      if (!r.ok) return;
      const j = await r.json();
      setThreadId(null);
      setImported({ title: j.conversation.title, source: j.conversation.source });
      setMessages((j.messages as { role: "user" | "assistant"; content: string }[]).map((m, i) => ({ id: `i${i}`, role: m.role, content: m.content, mood: "chill" })));
      setMood("idle");
      return;
    }
    const r = await fetch(`/api/threads/${it.id}`);
    if (!r.ok) return;
    const j = await r.json();
    setImported(null);
    setThreadId(j.thread.id);
    setMessages(j.messages);
    setMood("idle");
  };

  const newChat = () => { abort.current?.abort(); setMessages([]); setThreadId(null); setImported(null); setCategory(null); setMood("idle"); setDrawer(false); };
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const home = messages.length === 0;

  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col">
      {/* Header */}
      <header className="safe-top flex items-center justify-between px-4 pb-2">
        <PressButton onClick={() => setDrawer(true)} aria-label="Open menu" className="t-btn grid h-10 w-10 place-items-center border border-white/10 bg-white/[0.04]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </PressButton>
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-cyan to-violet-400 bg-clip-text text-xl font-semibold text-transparent">M</span>
          <span className="text-lg font-medium">Mawa <span className="text-cyan">AI</span></span>
          {theme.id === "mani" ? <span className="rounded-md border border-gold/60 bg-gold/10 px-1.5 py-0.5 font-serif text-[11px] font-semibold tracking-wider text-gold" aria-label="MK">MK</span> : null}
          {devMode ? <span className="rounded-md border border-gold/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-gold">dev</span> : null}
        </div>
        <Link href="/settings#themes" aria-label="Themes" className="t-btn grid h-10 w-10 place-items-center border border-white/10 bg-white/[0.04] active:scale-95">{theme.emoji}</Link>
      </header>

      {/* Body */}
      <div ref={scroller} className="scrollbar-none flex-1 overflow-y-auto px-4">
        <AnimatePresence mode="wait">
          {home ? (
            <motion.section key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center pt-6">
              <Avatar mood={mood === "idle" ? "flex" : mood} size={150} />
              <h1 className="mt-6 text-center font-serif text-[34px] leading-tight">{theme.copy.heroTitle[0]}<br />{theme.copy.heroTitle[1]}</h1>
              <div className="mt-6 flex w-full items-center gap-3 text-[11px] tracking-[0.25em] text-white/50">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-cyan/60" />{theme.copy.choose}<span className="h-px flex-1 bg-gradient-to-l from-transparent to-violet-400/60" />
              </div>
              <div className="mt-4 grid w-full grid-cols-3 gap-3">
                {CHIPS.map((c) => (
                  <PressButton
                    key={c.id}
                    onClick={() => setCategory((x) => (x === c.id ? null : c.id))}
                    className={`t-chip flex flex-col items-center gap-1.5 border bg-white/[0.03] py-4 text-sm shadow-[0_0_18px_var(--t-glow)] ${c.tone} ${category === c.id ? "bg-white/[0.10] ring-1 ring-white/30" : ""}`}
                    aria-pressed={category === c.id}
                  >
                    <motion.span className="text-2xl leading-none" animate={category === c.id ? theme.motion.flex : {}}>{c.icon}</motion.span>{c.label}
                  </PressButton>
                ))}
              </div>
              <Link href="/import" className="t-btn mt-5 border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] text-white/80 active:scale-95">
                ⬇︎ Bring your ChatGPT / Gemini history
              </Link>
            </motion.section>
          ) : (
            <motion.section key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 pb-4 pt-2">
              <div className="flex flex-col items-center">
                <Avatar mood={mood} size={96} />
                {imported ? (
                  <p className="mt-3 rounded-full border border-violet-400/30 px-3 py-1 text-xs text-violet-200">Imported from {imported.source === "chatgpt" ? "ChatGPT" : "Gemini"} · read only</p>
                ) : (
                  <div className="t-btn mt-3 flex border border-white/10 bg-white/[0.04] p-1" role="radiogroup" aria-label="Vibe">
                    {VIBES.map((v) => (
                      <PressButton key={v.id} role="radio" aria-checked={vibe === v.id} onClick={() => void saveVibe(v.id)}
                        className={`t-btn relative px-4 py-1.5 text-sm ${vibe === v.id ? "text-white" : "text-white/50"}`}>
                        {vibe === v.id ? <motion.span layoutId="vibe-pill" className={`t-btn absolute inset-0 border ${v.id === "full_roast" ? "border-roast/50 bg-roast/15" : "border-cyan/40 bg-cyan/10"}`} /> : null}
                        <span className="relative">{v.label}</span>
                      </PressButton>
                    ))}
                  </div>
                )}
              </div>
              {messages.map((m) => (
                <Bubble key={m.id} m={m} swipeable={!imported && m.id === lastAssistant?.id && !m.streaming} onSteer={steer} />
              ))}
              {!imported && lastAssistant && !lastAssistant.streaming && threadId ? (
                <div className="flex flex-wrap gap-2 pl-1">
                  <PressButton onClick={() => steer("harder")} disabled={busy} aria-label="Roast harder" className="t-chip border border-roast/40 bg-roast/10 px-3 py-1.5 text-xs text-orange-200 disabled:opacity-40">{icons.harder} {icons.harderLabel}</PressButton>
                  <PressButton onClick={() => steer("nicer")} disabled={busy} aria-label="Be nice" className="t-chip border border-care/40 bg-care/10 px-3 py-1.5 text-xs text-indigo-200 disabled:opacity-40">{icons.nicer} {icons.nicerLabel}</PressButton>
                  <span className="self-center text-[11px] text-white/35">{theme.copy.swipeHint}</span>
                </div>
              ) : null}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Composer */}
      <div className="safe-bottom px-4 pt-2">
        {imported ? (
          <PressButton onClick={newChat} className="t-input w-full border border-cyan/30 bg-cyan/10 py-3 text-sm text-cyan-100">Start a new chat</PressButton>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); triggerSend(); }} className="t-input flex flex-col border border-white/10 bg-panel/80 p-2 shadow-[0_0_30px_var(--t-glow)] backdrop-blur transition-[border-color,box-shadow] focus-within:border-cyan/50 focus-within:shadow-[0_0_36px_var(--t-glow)]">
            {pending.length ? (
              <div className="flex flex-wrap gap-2 px-1 pb-2">
                {pending.map((p) => (
                  <span key={p.id} className="relative flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 py-1 pl-1 pr-7 text-xs">
                    {p.preview ? <img src={p.preview} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-400/15">📄</span>}
                    <span className="max-w-28 truncate">{p.uploading ? "Uploading…" : p.name ?? "File"}</span>
                    <button type="button" aria-label="Remove attachment" onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))} className="absolute right-1 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-white/10">×</button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex items-end gap-2">
            <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => void upload(e.target.files)} />
            <PressButton type="button" onClick={() => fileInput.current?.click()} disabled={busy || pending.length >= 4} aria-label="Attach photo or PDF" className="t-btn grid h-10 w-10 shrink-0 place-items-center bg-cyan/10 text-cyan disabled:opacity-40">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.5l-8.5 8.5a5.5 5.5 0 01-7.8-7.8l9-9a3.7 3.7 0 015.2 5.2l-9 9a1.8 1.8 0 01-2.6-2.6l8.3-8.3" /></svg>
            </PressButton>
            {theme.id === "mani" ? <span aria-hidden className="t-prompt self-center pl-1 font-mono text-[15px] text-emerald-200">&gt;_</span> : null}
            <textarea
              ref={textRef}
              value={input} onChange={(e) => setInput(e.target.value.slice(0, 8000))}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); triggerSend(); } }}
              rows={1} placeholder={mic.recording ? `Listening… ${Math.floor(mic.elapsed / 1000)}s` : transcribing ? "Turning your voice into words…" : home ? theme.copy.placeholder : theme.copy.placeholderChat} aria-label="Message"
              className="min-h-10 flex-1 resize-none bg-transparent py-2 text-[16px] leading-6 outline-none [scrollbar-width:thin] placeholder:italic placeholder:text-white/35"
            />
            {busy ? (
              <PressButton type="button" onClick={() => abort.current?.abort()} aria-label="Stop" className="t-btn grid h-10 w-10 place-items-center bg-white/10">■</PressButton>
            ) : !input.trim() && !ready.length ? (
              <PressButton type="button" onClick={() => (mic.recording ? mic.stop() : void mic.start())} disabled={transcribing} aria-label={mic.recording ? "Stop recording" : "Record voice"}
                className={`t-btn relative grid h-10 w-10 place-items-center ${mic.recording ? "bg-roast text-ink" : "bg-white/10 text-cyan"} disabled:opacity-40`}>
                {mic.recording ? <span className="t-btn absolute inset-0 animate-ping bg-roast/40" aria-hidden /> : null}
                {transcribing ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan border-t-transparent" /> : mic.recording ? <span className="relative h-3.5 w-3.5 rounded-sm bg-white" /> : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
                )}
              </PressButton>
            ) : (
              <SendButton ref={sendBtnRef} disabled={pending.some((p) => p.uploading)} onSend={() => void send()} onFire={sg.fire} badge={<NextGameBadge game={sg.next} hint={sg.hint} />} />
            )}
            </div>
          </form>
        )}
        <div className="mt-2 flex justify-center">
          <span className="t-chip border border-violet-400/25 px-3 py-1 text-[11px] text-violet-200/80">
            ⇄ {category ? `${CHIPS.find((c) => c.id === category)!.label} mode` : "Auto-routed"}
          </span>
        </div>
      </div>

      <SendGameLayer shot={sg.shot} onDone={sg.done} />

      {/* Toast */}
      <AnimatePresence>
        {toast ? (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="t-chip fixed left-1/2 top-16 z-50 -translate-x-1/2 border border-white/10 bg-panel px-4 py-2 text-sm shadow-lg">{toast}</motion.div>
        ) : null}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {drawer ? (
          <>
            <motion.div key="scrim" className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.nav key="drawer" className="safe-top fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-sm flex-col overflow-hidden border-r border-line bg-panel px-4"
              initial={theme.motion.drawer.initial} animate={theme.motion.drawer.animate} exit={theme.motion.drawer.exit} transition={theme.motion.drawer.transition}
              onAnimationStart={() => haptic("tap")}
              drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, i) => { if (i.offset.x < -80) setDrawer(false); }}>
              <p className="pb-3 pt-2 text-sm text-white/50">Hey {userName.split(" ")[0]} 👋</p>
              <PressButton onClick={newChat} className="t-btn mb-4 border border-cyan/30 bg-cyan/10 py-2.5 text-sm text-cyan-100">+ New chat</PressButton>
              <div className="scrollbar-none flex-1 overflow-y-auto">
                <SideList title="Your chats" items={side.threads} onOpen={openThread} empty={theme.copy.emptyChats} />
                <SideList title="Imported" items={side.imported} onOpen={openThread} empty={theme.copy.emptyImports} />
              </div>
              <div className="safe-bottom flex flex-col gap-1 border-t border-line pt-3 text-sm">
                <Link href="/import" className="rounded-lg px-2 py-2 hover:bg-white/5">⬇︎ Import ChatGPT / Gemini</Link>
                <Link href="/personality" className="rounded-lg px-2 py-2 hover:bg-white/5">✦ Personality</Link>
                <Link href="/settings#themes" className="rounded-lg px-2 py-2 hover:bg-white/5">{theme.emoji} Themes</Link>
                <Link href="/settings" className="rounded-lg px-2 py-2 hover:bg-white/5">⚙︎ Your data</Link>
                <Link href="/signout" className="rounded-lg px-2 py-2 text-white/50 hover:bg-white/5">Sign out</Link>
              </div>
            </motion.nav>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SideList({ title, items, onOpen, empty }: { title: string; items: SideItem[]; onOpen: (i: SideItem) => void; empty: string }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/40">{title}</p>
      {items.length === 0 ? <EmptyState compact text={empty} /> : null}
      <ul className="flex flex-col gap-0.5">
        {items.map((it) => (
          <li key={it.id}>
            <PressButton onClick={() => onOpen(it)} className="t-chip flex w-full items-center gap-2 px-2 py-2 text-left text-sm hover:bg-white/5">
              {it.kind === "imported" ? (
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${it.source === "chatgpt" ? "bg-emerald-400/15 text-emerald-200" : "bg-sky-400/15 text-sky-200"}`}>
                  {it.source === "chatgpt" ? "ChatGPT" : "Gemini"}
                </span>
              ) : null}
              <span className="truncate"><RichText text={it.title} /></span>
            </PressButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
