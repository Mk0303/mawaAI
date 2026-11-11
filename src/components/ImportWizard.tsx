"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { ThemedProgress } from "./theme/parts";
import { BackHeader } from "./BackHeader";

type Source = "chatgpt" | "gemini";
type Stage = "start" | "pick" | "guide" | "upload" | "working" | "done" | "error";
type Summary = { source: Source; conversations: number; messages: number; duplicates: number; profile: string | null; headline: string };

const GUIDES: Record<Source, { title: string; steps: { icon: string; text: React.ReactNode }[]; wait: string }> = {
  chatgpt: {
    title: "Get your ChatGPT chats",
    steps: [
      { icon: "👤", text: <>Open <b>ChatGPT</b> (app or chatgpt.com), tap your <b>name or profile picture</b>, then <b>Settings</b>.</> },
      { icon: "🗂️", text: <>Tap <b>Data controls</b> → <b>Export data</b> → <b>Confirm export</b>.</> },
      { icon: "📧", text: <>Wait for the email from OpenAI and tap <b>Download data export</b>. The link only works for 24 hours.</> },
      { icon: "📦", text: <>Come back here and pick that <b>.zip</b> file. Don&apos;t open or unzip it.</> },
    ],
    wait: "The email usually comes in a few minutes, but it can take longer if you have lots of chats.",
  },
  gemini: {
    title: "Get your Gemini chats",
    steps: [
      { icon: "🌐", text: <>Open <b>takeout.google.com</b>, signed in with the Google account you use for Gemini.</> },
      { icon: "☑️", text: <>Tap <b>Deselect all</b>. Scroll to <b>My Activity</b> and tick it. Tap <b>All activity data included</b>, choose <b>Deselect all</b>, tick only <b>Gemini Apps</b>, then <b>OK</b>.</> },
      { icon: "📧", text: <>Tap <b>Next step</b> → keep <b>Send download link via email</b> and <b>.zip</b> → <b>Create export</b>.</> },
      { icon: "📦", text: <>When Google emails you, download the <b>.zip</b> and pick it here. No unzipping needed.</> },
    ],
    wait: "Google can take a few hours (sometimes a day) to send the email. Come back whenever it lands.",
  },
};

const WORKING_LINES = [
  "Reading your chats. Judging silently…",
  "Wow. You asked that? Moving on…",
  "Counting how many times you said 'thanks'…",
  "Building your memory. I never forget, unlike you…",
  "Writing your 'about you'. Be afraid…",
];

export function ImportWizard() {
  const [stage, setStage] = useState<Stage>("start");
  const [source, setSource] = useState<Source>("chatgpt");
  const [progress, setProgress] = useState(0);
  const [creep, setCreep] = useState(70);
  // After upload finishes the server is still parsing: creep from 70% toward 95% so it never looks stuck.
  useEffect(() => {
    if (progress < 100) return;
    setCreep(70);
    const t = setInterval(() => setCreep((c) => Math.min(95, c + 2)), 600);
    return () => clearInterval(t);
  }, [progress]);
  const [line, setLine] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage !== "working") return;
    const t = setInterval(() => setLine((l) => (l + 1) % WORKING_LINES.length), 2200);
    return () => clearInterval(t);
  }, [stage]);

  const upload = (file: File) => {
    if (file.size > 200 * 1024 * 1024) { setError("That file is over 200 MB, a bit much for me right now."); setStage("error"); return; }
    if (!/\.(zip|json|html?)$/i.test(file.name)) { setError("That's not the export file. Look for a .zip from the ChatGPT or Google email."); setStage("error"); return; }
    setStage("working"); setProgress(0); setLine(0);
    const fd = new FormData();
    fd.append("file", file, file.name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/import");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let j: Record<string, unknown> = {};
      try { j = JSON.parse(xhr.responseText) as Record<string, unknown>; } catch { /* handled below */ }
      if (xhr.status >= 200 && xhr.status < 300) { setSummary(j as unknown as Summary); setStage("done"); }
      else { setError(typeof j.error === "string" ? j.error : "Something went wrong on my side. Try again in a minute."); setStage("error"); }
    };
    xhr.onerror = () => { setError("The upload got cut off. Check your internet and try again."); setStage("error"); };
    xhr.send(fd);
  };

  const g = GUIDES[source];

  return (
    <main className="mx-auto min-h-dvh max-w-xl">
      <BackHeader title="Import history" />
      <div className="px-4 pb-12">
        <AnimatePresence mode="wait">
          {stage === "start" && (
            <motion.section key="start" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center pt-6 text-center">
              <Avatar mood="smug" size={130} />
              <h2 className="mt-6 font-serif text-3xl leading-tight">Tell me everything.<br />Literally.</h2>
              <p className="mt-3 max-w-xs text-sm text-white/55">Bring your old ChatGPT or Gemini chats so I can remember what you care about.</p>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setStage("pick")}
                className="mt-8 w-full t-card bg-gradient-to-r from-cyan to-violet-400 py-5 text-lg font-semibold text-ink shadow-[0_0_40px_rgba(34,211,238,0.35)]">
                Import my ChatGPT / Gemini
              </motion.button>
              <p className="mt-4 text-xs text-white/35">Only you can see your imported chats. Delete them anytime in Your data.</p>
            </motion.section>
          )}

          {stage === "pick" && (
            <motion.section key="pick" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="pt-4">
              <h2 className="font-serif text-2xl">Where are your chats?</h2>
              <div className="mt-5 grid gap-3">
                {(["chatgpt", "gemini"] as const).map((s) => (
                  <motion.button key={s} whileTap={{ scale: 0.97 }} onClick={() => { setSource(s); setStage("guide"); }}
                    className={`flex items-center gap-4 t-card border p-5 text-left ${s === "chatgpt" ? "border-emerald-400/40 bg-emerald-400/5" : "border-sky-400/40 bg-sky-400/5"}`}>
                    <span className={`grid h-14 w-14 place-items-center t-card text-2xl ${s === "chatgpt" ? "bg-emerald-400/15" : "bg-sky-400/15"}`}>{s === "chatgpt" ? "🟢" : "✨"}</span>
                    <span><span className="block text-lg font-medium">{s === "chatgpt" ? "ChatGPT" : "Gemini"}</span>
                      <span className="text-xs text-white/50">{s === "chatgpt" ? "From ChatGPT settings, takes a few minutes" : "From Google Takeout, can take a few hours"}</span></span>
                  </motion.button>
                ))}
              </div>
              <button onClick={() => setStage("upload")} className="mt-6 w-full text-center text-sm text-cyan">I already have the zip →</button>
            </motion.section>
          )}

          {stage === "guide" && (
            <motion.section key="guide" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="pt-4">
              <h2 className="font-serif text-2xl">{g.title}</h2>
              <ol className="mt-5 flex flex-col gap-3">
                {g.steps.map((st, i) => (
                  <motion.li key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="flex gap-3 t-card border border-white/10 bg-white/[0.03] p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center t-btn bg-cyan/10 text-lg">{st.icon}</span>
                    <div><p className="text-[11px] uppercase tracking-widest text-cyan/80">Step {i + 1}</p><p className="mt-1 text-[14.5px] leading-relaxed text-white/85 [&_b]:text-white">{st.text}</p></div>
                  </motion.li>
                ))}
              </ol>
              <p className="mt-4 t-card border border-gold/30 bg-gold/5 p-3 text-xs leading-relaxed text-amber-100">⏳ {g.wait}</p>
              <button onClick={() => setStage("upload")} className="mt-6 w-full t-card bg-cyan py-4 font-semibold text-ink active:scale-[0.98]">I have the zip, let&apos;s go</button>
              <button onClick={() => setStage("pick")} className="mt-3 w-full text-center text-sm text-white/50">← Pick a different app</button>
            </motion.section>
          )}

          {stage === "upload" && (
            <motion.section key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="pt-4">
              <h2 className="font-serif text-2xl">Drop the zip here</h2>
              <p className="mt-1 text-sm text-white/55">Pick it exactly as you downloaded it. I&apos;ll figure out if it&apos;s ChatGPT or Gemini.</p>
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
                className={`mt-5 flex cursor-pointer flex-col items-center justify-center t-card border-2 border-dashed px-6 py-14 text-center transition ${dragOver ? "border-cyan bg-cyan/10" : "border-white/20 bg-white/[0.02]"}`}>
                <span className="text-5xl">📦</span>
                <span className="mt-4 text-lg font-medium">Tap to choose your file</span>
                <span className="mt-1 text-xs text-white/45">On iPhone, look in Files → Downloads</span>
                <input ref={fileRef} type="file" className="sr-only"
                  accept=".zip,.json,.html,application/zip,application/x-zip-compressed,application/json,text/html"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
              </label>
              <button onClick={() => setStage("guide")} className="mt-4 w-full text-center text-sm text-white/50">How do I get the zip?</button>
            </motion.section>
          )}

          {stage === "working" && (
            <motion.section key="working" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center pt-10 text-center">
              <Avatar mood="thinking" size={140} />
              <div className="mt-8"><ThemedProgress pct={progress < 100 ? progress * 0.7 : creep} label="Import progress" /></div>
              <p className="mt-2 text-xs text-white/40">{progress < 100 ? `Uploading ${progress}%` : "Reading your chats"}</p>
              <AnimatePresence mode="wait">
                <motion.p key={line} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-6 font-serif text-xl">{WORKING_LINES[line]}</motion.p>
              </AnimatePresence>
              <p className="mt-6 text-xs text-white/35">Keep this screen open. Big exports can take a minute.</p>
            </motion.section>
          )}

          {stage === "done" && summary && (
            <motion.section key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center pt-8 text-center">
              <Avatar mood="flex" size={140} />
              <h2 className="mt-6 font-serif text-3xl leading-tight">{summary.headline}</h2>
              <p className="mt-2 text-sm text-white/55">{summary.messages} messages{summary.duplicates ? ` · ${summary.duplicates} already here, skipped` : ""}</p>
              {summary.profile ? (
                <div className="mt-6 w-full t-card border border-gold/40 bg-gold/5 p-4 text-left">
                  <p className="text-[11px] uppercase tracking-widest text-gold">What I figured out about you</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/85">{summary.profile}</p>
                </div>
              ) : null}
              <Link href="/" className="mt-8 w-full t-card bg-cyan py-4 font-semibold text-ink">Start chatting</Link>
              <Link href="/settings" className="mt-3 text-sm text-white/50">Manage imported data</Link>
            </motion.section>
          )}

          {stage === "error" && (
            <motion.section key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center pt-10 text-center">
              <Avatar mood="care" size={120} />
              <h2 className="mt-6 font-serif text-2xl">Okay, that didn&apos;t work.</h2>
              <p className="mt-3 max-w-xs text-sm text-white/70">{error}</p>
              <button onClick={() => setStage("upload")} className="mt-8 w-full t-card bg-cyan py-4 font-semibold text-ink">Try another file</button>
              <button onClick={() => setStage("guide")} className="mt-3 text-sm text-white/50">Show me the steps again</button>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
