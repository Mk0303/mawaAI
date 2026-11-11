"use client";
import { useCallback, useRef, useState } from "react";

const MAX_MS = 175_000;

/** Pick a container the browser can record. iPhone Safari only does audio/mp4. */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return undefined;
}

export function useRecorder(onAudio: (blob: Blob) => void, onError: (msg: string) => void) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => { if (rec.current?.state === "recording") rec.current.stop(); }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError("This browser can't record audio. Try Safari or Chrome.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      onError("I need mic permission. Allow it in your browser settings and try again.");
      return;
    }
    const mime = pickMime();
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const parts: Blob[] = [];
    const t0 = Date.now();
    r.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      setRecording(false);
      setElapsed(0);
      const blob = new Blob(parts, { type: (r.mimeType || mime || "audio/webm").split(";")[0] });
      if (Date.now() - t0 < 600 || blob.size < 800) { onError("That was too short. Hold on a sec longer."); return; }
      onAudio(blob);
    };
    rec.current = r;
    r.start(1000); // timeslice so Safari flushes data regularly
    setRecording(true);
    timer.current = setInterval(() => {
      const ms = Date.now() - t0;
      setElapsed(ms);
      if (ms > MAX_MS) stop();
    }, 250);
  }, [onAudio, onError, stop]);

  return { recording, elapsed, start, stop };
}
