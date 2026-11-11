import type { ModelCapability } from "./types";

/**
 * Per-model quota + health tracker. In-memory for M1; same interface can be
 * backed by Upstash Redis (atomic Lua reserve) later.
 */
export interface QuotaSnapshot {
  rpmLeft: number; rpdLeft: number; tpmLeft: number;
  coolDownUntil: number; errorRate: number; p50LatencyMs: number;
}

export interface QuotaTracker {
  snapshot(m: ModelCapability, now?: number): QuotaSnapshot;
  reserve(m: ModelCapability, tokens: number, now?: number): boolean;
  success(m: ModelCapability, latencyMs: number): void;
  penalize(m: ModelCapability, status: number, retryAfterMs?: number, now?: number): void;
}

interface State {
  minuteStart: number; minuteReq: number; minuteTok: number;
  dayKey: string; dayReq: number;
  coolDownUntil: number; errEma: number; latEma: number;
}

const dayKeyFor = (m: ModelCapability, now: number) => {
  // Gemini resets at midnight Pacific, Groq at midnight UTC (approximate PT as UTC-8).
  const shift = m.providerId === "gemini" ? -8 * 3600_000 : 0;
  return new Date(now + shift).toISOString().slice(0, 10);
};

export class MemoryQuota implements QuotaTracker {
  private s = new Map<string, State>();

  private get(m: ModelCapability, now: number): State {
    let st = this.s.get(m.id);
    if (!st) {
      st = { minuteStart: now, minuteReq: 0, minuteTok: 0, dayKey: dayKeyFor(m, now), dayReq: 0, coolDownUntil: 0, errEma: 0, latEma: 1500 };
      this.s.set(m.id, st);
    }
    if (now - st.minuteStart >= 60_000) { st.minuteStart = now; st.minuteReq = 0; st.minuteTok = 0; }
    const dk = dayKeyFor(m, now);
    if (dk !== st.dayKey) { st.dayKey = dk; st.dayReq = 0; }
    return st;
  }

  snapshot(m: ModelCapability, now = Date.now()): QuotaSnapshot {
    const st = this.get(m, now);
    return {
      rpmLeft: m.limits.rpm - st.minuteReq,
      rpdLeft: m.limits.rpd - st.dayReq,
      tpmLeft: m.limits.tpm - st.minuteTok,
      coolDownUntil: st.coolDownUntil,
      errorRate: st.errEma,
      p50LatencyMs: st.latEma,
    };
  }

  reserve(m: ModelCapability, tokens: number, now = Date.now()): boolean {
    const st = this.get(m, now);
    if (st.coolDownUntil > now) return false;
    if (st.minuteReq + 1 > m.limits.rpm || st.dayReq + 1 > m.limits.rpd) return false;
    if (st.minuteTok + tokens > m.limits.tpm) return false;
    st.minuteReq++; st.dayReq++; st.minuteTok += tokens;
    return true;
  }

  success(m: ModelCapability, latencyMs: number) {
    const st = this.get(m, Date.now());
    st.errEma *= 0.8;
    st.latEma = st.latEma * 0.7 + latencyMs * 0.3;
  }

  penalize(m: ModelCapability, status: number, retryAfterMs?: number, now = Date.now()) {
    const st = this.get(m, now);
    st.errEma = st.errEma * 0.8 + 0.2;
    if (status === 429) st.coolDownUntil = now + Math.min(retryAfterMs ?? 30_000, 15 * 60_000);
    else if (status === 402) st.coolDownUntil = now + 60 * 60_000; // account needs billing: park it for an hour
    else if (status === 401 || status === 403 || status === 404) st.coolDownUntil = now + 10 * 60_000; // bad key/model id
    else if (status >= 500 || status === 0) st.coolDownUntil = now + 5_000;
  }
}
