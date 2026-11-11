import "server-only";

/** Outbound fetch with timeout and response size cap. Hosts are fixed constants (no SSRF surface). */
export async function boundedFetch(url: string, init: RequestInit & { timeoutMs: number; maxBytes: number }): Promise<{ status: number; headers: Headers; body: Buffer }> {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new ToolError("insecure_url", 0);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs);
  try {
    const res = await fetch(u, { ...init, signal: ctrl.signal, redirect: "error" });
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let n = 0;
    if (reader) for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.byteLength;
      if (n > init.maxBytes) { await reader.cancel(); throw new ToolError("too_large", res.status); }
      chunks.push(value);
    }
    return { status: res.status, headers: res.headers, body: Buffer.concat(chunks) };
  } catch (e) {
    if (e instanceof ToolError) throw e;
    throw new ToolError("network_or_timeout", 0);
  } finally {
    clearTimeout(t);
  }
}

export class ToolError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
