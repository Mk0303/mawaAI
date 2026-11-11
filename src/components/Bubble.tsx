"use client";
import { motion, useAnimationControls, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { useEffect } from "react";
import { RichText } from "./RichText";
import { useTheme } from "./theme/ThemeProvider";
import { TypingIndicator, useIcons } from "./theme/parts";

export type UiMood = "chill" | "smug" | "roast" | "flex" | "care" | null;

export interface UiAttachment { id: string; kind: "photo" | "pdf" | "image_gen"; name?: string | null; pages?: number | null; preview?: string }
export interface UiSource { title: string; url: string; host: string }
export interface UiMessage {
  id: string; role: "user" | "assistant"; content: string;
  model?: string | null; mood?: UiMood; ms?: number | null; streaming?: boolean; fallback?: boolean;
  attachments?: UiAttachment[]; sources?: UiSource[]; status?: string | null;
}

function AttachmentStrip({ items }: { items: UiAttachment[] }) {
  return (
    <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
      {items.map((a) => a.kind === "photo" ? (
        <img key={a.id} src={a.preview ?? `/api/media/${a.id}`} alt={a.name ?? "Photo"} className="h-24 w-24 rounded-xl border border-white/10 object-cover" />
      ) : (
        <a key={a.id} href={`/api/media/${a.id}`} className="flex items-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs text-sky-100">
          📄 <span className="max-w-40 truncate">{a.name ?? "Document"}</span>{a.pages ? <span className="text-white/40">· {a.pages}p</span> : null}
        </a>
      ))}
    </div>
  );
}

export function ImageCard({ id }: { id: string }) {
  const url = `/api/media/${id}`;
  return (
    <motion.figure initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="t-bubble-bot relative mb-2 overflow-hidden border border-fuchsia-400/30 shadow-[0_0_24px_rgba(232,121,249,0.18)]">
      <img src={url} alt="Generated image" className="block aspect-square w-full max-w-[320px] bg-black/40 object-cover" />
      <a href={`${url}?download=1`} download className="t-btn absolute bottom-2 right-2 border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur active:scale-95">⬇︎ Save</a>
    </motion.figure>
  );
}

function SourceChips({ items }: { items: UiSource[] }) {
  return (
    <div className="mt-2 flex max-w-[88%] flex-wrap gap-1.5">
      {items.map((s, i) => (
        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer nofollow" title={s.title}
          className="t-chip inline-flex max-w-[11rem] items-center gap-1 border border-teal-400/30 bg-teal-400/10 px-2.5 py-1 text-[11px] text-teal-100 active:scale-95">
          <span className="text-teal-300/70">{i + 1}</span><span className="truncate">{s.host}</span>
        </a>
      ))}
    </div>
  );
}

const MOOD_CLASS: Record<string, string> = { roast: "t-mood-roast", flex: "t-mood-flex", care: "t-mood-care", smug: "t-mood-smug", chill: "" };

export function ModelBadge({ m }: { m: UiMessage }) {
  if (!m.model || m.streaming) return null;
  const secs = m.ms != null ? `${(m.ms / 1000).toFixed(1)}s` : "";
  const flex = m.mood === "flex";
  const busy = m.model === "Busy";
  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] ${flex ? "border-gold/50 text-gold" : busy ? "border-roast/40 text-roast" : "border-violet-400/30 text-violet-200"} bg-black/30`}
    >
      <span aria-hidden>{flex ? "⚡" : busy ? "⏳" : "✦"}</span>
      {busy ? "All models busy" : flex ? `${m.model} flexed this in ${secs}` : `${m.model} · ${secs}`}
      {m.fallback && !busy ? <span className="text-white/40">· backup</span> : null}
    </motion.span>
  );
}

export function Bubble({ m, swipeable, onSteer }: { m: UiMessage; swipeable: boolean; onSteer?: (s: "harder" | "nicer") => void }) {
  const { theme, haptic } = useTheme();
  const icons = useIcons();
  const controls = useAnimationControls();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-100, 0, 100], [-theme.motion.swipeTilt, 0, theme.motion.swipeTilt]);
  const harderOpacity = useTransform(x, [20, 90], [0, 1]);
  const nicerOpacity = useTransform(x, [-90, -20], [1, 0]);
  useEffect(() => {
    if (m.role !== "assistant" || m.streaming) return;
    if (m.mood === "roast") { void controls.start(theme.motion.roast); haptic("roast"); }
    else if (m.mood === "flex") { void controls.start(theme.motion.flex); haptic("flex"); }
  }, [m.mood, m.streaming, m.role, controls, theme, haptic]);

  if (m.role === "user") {
    return (
      <motion.div initial={theme.motion.userIn.initial} animate={theme.motion.userIn.animate} transition={theme.motion.userIn.transition} className="flex justify-end">
        <div className="flex max-w-[82%] flex-col items-end">
          {m.attachments?.length ? <AttachmentStrip items={m.attachments} /> : null}
          <div className="t-bubble-user border border-white/10 px-4 py-2.5 text-[15px] leading-relaxed">
            <RichText text={m.content} />
          </div>
        </div>
      </motion.div>
    );
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (!onSteer) return;
    if (info.offset.x > 90) { haptic("swipe"); onSteer("harder"); }
    else if (info.offset.x < -90) { haptic("swipe"); onSteer("nicer"); }
  };

  return (
    <motion.div initial={theme.motion.bubbleIn.initial} animate={theme.motion.bubbleIn.animate} transition={theme.motion.bubbleIn.transition} className="relative flex flex-col items-start">
      {swipeable ? (<>
        <motion.span aria-hidden style={{ opacity: harderOpacity }} className="pointer-events-none absolute left-0 top-3 -translate-x-1 text-xl">{icons.harder}</motion.span>
        <motion.span aria-hidden style={{ opacity: nicerOpacity }} className="pointer-events-none absolute right-2 top-3 text-xl">{icons.nicer}</motion.span>
      </>) : null}
      {m.attachments?.filter((a) => a.kind === "image_gen").map((a) => <ImageCard key={a.id} id={a.id} />)}
      <motion.div
        animate={controls}
        style={{ x, rotate }}
        drag={swipeable ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={theme.motion.swipeElastic}
        onDragEnd={onDragEnd}
        className={`t-bubble-bot relative max-w-[88%] touch-pan-y border px-4 py-3 text-[15px] leading-relaxed ${m.streaming ? "" : MOOD_CLASS[m.mood ?? "chill"] ?? ""} transition-[background-color,border-color,box-shadow] duration-500`}
      >
                        <span className={`relative ${!m.streaming && (m.mood === "roast" || m.mood === "flex") ? "font-serif text-[16px]" : ""}`}>
          {m.content ? <RichText text={m.content} /> : m.status ? <span className="text-sm italic text-white/60">{m.status} <TypingIndicator /></span> : <TypingIndicator />}
          {m.streaming && m.content ? <span aria-hidden className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-cyan/50" /> : null}
        </span>
      </motion.div>
      {m.sources?.length ? <SourceChips items={m.sources} /> : null}
      <ModelBadge m={m} />
    </motion.div>
  );
}
