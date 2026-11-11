import type { ChatMessage, ModelCapability, ProviderAdapter, ProviderId, StreamOptions } from "../router/types";
import { ProviderError } from "../router/types";
import { providerDef, resolveProvider } from "../router/providers";

const MAX_STREAM_BYTES = 512 * 1024;

/**
 * Some free models (e.g. Gemma) put their reasoning inline as <thought>...</thought>
 * or <think>...</think>. Strip it from the stream so users only see the answer.
 */
export function createThoughtFilter() {
  let buf = "";
  let inside = false;
  const OPEN = /<(thought|think|thinking)>/i;
  const CLOSE = /<\/(thought|think|thinking)>/i;
  return {
    push(chunk: string): string {
      buf += chunk;
      let out = "";
      for (;;) {
        if (inside) {
          const m = CLOSE.exec(buf);
          if (!m) { buf = buf.slice(-12); return out; }
          buf = buf.slice(m.index + m[0].length).replace(/^\s+/, "");
          inside = false;
        } else {
          const m = OPEN.exec(buf);
          if (m) { out += buf.slice(0, m.index); buf = buf.slice(m.index + m[0].length); inside = true; continue; }
          // Hold back a possible partial "<thou" at the end.
          const lt = buf.lastIndexOf("<");
          if (lt >= 0 && buf.length - lt < 11) { out += buf.slice(0, lt); buf = buf.slice(lt); }
          else { out += buf; buf = ""; }
          return out;
        }
      }
    },
    flush(): string { const r = inside ? "" : buf; buf = ""; return r; },
  };
}

/** One adapter for every OpenAI-compatible chat API (Groq, Gemini, OpenRouter, ...). */
export class OpenAICompatibleAdapter implements ProviderAdapter {
  label: string;
  constructor(public id: Exclude<ProviderId, "mock">, private env: Record<string, string | undefined> = process.env) {
    this.label = providerDef(id)?.label ?? id;
  }

  available(): boolean {
    const d = providerDef(this.id);
    return !!d && !!resolveProvider(d, this.env);
  }

  async *stream(m: ModelCapability, messages: ChatMessage[], opts: StreamOptions): AsyncIterable<string> {
    const def = providerDef(this.id);
    const conf = def && resolveProvider(def, this.env);
    if (!def || !conf) throw new ProviderError(401, undefined, "not_configured");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    opts.signal?.addEventListener("abort", () => ctrl.abort(), { once: true });
    let res: Response;
    try {
      res = await fetch(`${conf.url}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${conf.key}`, ...(def.extraHeaders ?? {}) },
        body: JSON.stringify({
          model: m.model,
          messages: messages.map((x) => x.images?.length && x.role === "user"
            ? { role: x.role, content: [{ type: "text", text: x.content }, ...x.images.map((url) => ({ type: "image_url", image_url: { url } }))] }
            : { role: x.role, content: x.content }),
          stream: true,
          max_tokens: opts.maxTokens,
          temperature: opts.json ? 0 : 0.8,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          // GLM thinks by default (slow, eats the token budget); a chat fallback should just answer.
          ...(m.providerId === "zai" ? { thinking: { type: "disabled" } } : {}),
        }),
      });
    } catch {
      clearTimeout(timer);
      throw new ProviderError(0, undefined, "network_or_timeout");
    }
    if (!res.ok || !res.body) {
      clearTimeout(timer);
      const ra = Number(res.headers.get("retry-after"));
      await res.body?.cancel().catch(() => undefined);
      throw new ProviderError(res.status, Number.isFinite(ra) && ra > 0 ? ra * 1000 : undefined, `http_${res.status}`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let seen = 0;
    const filter = createThoughtFilter();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        seen += value.byteLength;
        if (seen > MAX_STREAM_BYTES) throw new ProviderError(502, undefined, "stream_too_large");
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") { const rest = filter.flush(); if (rest) yield rest; return; }
          try {
            const j = JSON.parse(data) as { choices?: { delta?: { content?: unknown } }[]; error?: unknown };
            if (j.error) throw new ProviderError(502, undefined, "stream_error");
            const c = j.choices?.[0]?.delta?.content;
            if (typeof c === "string" && c) { const out = filter.push(c); if (out) yield out; }
          } catch (e) {
            if (e instanceof ProviderError) throw e;
            // ignore malformed keep-alive lines
          }
        }
      }
      const rest = filter.flush();
      if (rest) yield rest;
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError(0, undefined, "stream_aborted");
    } finally {
      clearTimeout(timer);
      reader.releaseLock();
    }
  }
}
