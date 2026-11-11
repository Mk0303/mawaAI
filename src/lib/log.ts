/** Structured logger. Never logs message content, tokens, cookies or keys. */
type Level = "info" | "warn" | "error";
const SECRETISH = /(key|token|secret|password|cookie|authorization)/i;

function clean(v: unknown): unknown {
  if (typeof v === "string") return v.replace(/[\r\n]+/g, " ").slice(0, 300);
  if (typeof v === "number" || typeof v === "boolean" || v == null) return v;
  return "[object]";
}

export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const out: Record<string, unknown> = { t: new Date().toISOString(), level, event: clean(event) };
  for (const [k, v] of Object.entries(fields)) out[k] = SECRETISH.test(k) ? "[redacted]" : clean(v);
  const line = JSON.stringify(out);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
