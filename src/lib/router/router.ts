import type { ChatMessage, Classification, Intent, ModelCapability, ProviderAdapter, ProviderId, RouteDecision } from "./types";
import { ProviderError } from "./types";
import { ROUTE_TABLE } from "./registry";
import type { QuotaSnapshot, QuotaTracker } from "./quota";
import { CLASSIFIER_PROMPT, defaultClassification, parseClassifierJson, rulesClassify, type ClassifyInput } from "./classifier";
import { fitContext, tokensOf, type ContextInput } from "./context";

export function score(m: ModelCapability, q: QuotaSnapshot, est: number, intent: Intent, now = Date.now()): number {
  if (q.rpdLeft <= 0 || q.rpmLeft <= 0 || q.coolDownUntil > now) return -Infinity;
  const fit = est <= m.maxInputPerRequest * 0.75 ? 1 : 0.4; // 0.4: needs trimming
  return 0.45 * (m.quality[intent] ?? 0.3)
    + 0.2 * Math.min(1, q.rpdLeft / 50)
    + 0.15 * fit
    + 0.1 * (1 - q.errorRate)
    + 0.1 * (1 - Math.min(1, q.p50LatencyMs / 8000));
}

export type AnswerEvent =
  | { type: "route"; decision: RouteDecision }
  | { type: "model"; modelId: string; label: string; fallback: boolean }
  | { type: "delta"; text: string }
  | { type: "done"; modelId: string | null; label: string; ms: number; plan: RouteDecision["contextPlan"]; dropped: ChatMessage[] };

export const BUSY_TEXT = "Busy right now, give me a few seconds and try again.";

export class Router {
  private byId: Map<string, ModelCapability>;
  constructor(
    models: ModelCapability[],
    private adapters: Partial<Record<ProviderId, ProviderAdapter>>,
    private quota: QuotaTracker,
    private opts: { llmClassifier: boolean; onEvent?: (e: Record<string, unknown>) => void } = { llmClassifier: false },
  ) {
    this.byId = new Map(models.map((m) => [m.id, m]));
  }

  private usable(id: string): ModelCapability | undefined {
    const m = this.byId.get(id);
    if (!m || m.providerId === "mock") return undefined;
    return this.adapters[m.providerId]?.available() ? m : undefined;
  }

  hasRealProvider(): boolean {
    return [...this.byId.keys()].some((id) => !!this.usable(id));
  }

  async classify(inp: ClassifyInput): Promise<Classification> {
    const r = rulesClassify(inp);
    if (r) return r;
    const base = defaultClassification(inp);
    if (!this.opts.llmClassifier) return base;
    for (const id of ["groq:gpt-oss-20b", "gemini:gemma-26b"]) {
      const m = this.usable(id);
      if (!m || !this.quota.reserve(m, 400)) continue;
      try {
        let out = "";
        for await (const c of this.adapters[m.providerId]!.stream(m, [
          { role: "system", content: CLASSIFIER_PROMPT },
          { role: "user", content: inp.text.slice(0, 1200) },
        ], { timeoutMs: 4000, maxTokens: 60, json: true })) { out += c; if (out.length > 600) break; }
        const parsed = parseClassifierJson(out, base);
        if (parsed) return parsed;
      } catch (e) {
        if (e instanceof ProviderError) this.quota.penalize(m, e.status, e.retryAfterMs);
      }
    }
    return base;
  }

  route(cls: Classification, estInputTokens: number, fixedTokens = 0): RouteDecision {
    const now = Date.now();
    const chain = (ROUTE_TABLE[cls.intent] ?? ROUTE_TABLE.chat)
      .map((id) => this.usable(id))
      .filter((m): m is ModelCapability => !!m && m.intents.includes(cls.intent))
      .filter((m) => !cls.needsVision || m.vision === true)
      // Fixed context (system + docs + web) that can't be trimmed must fit the model.
      .filter((m) => fixedTokens <= m.maxInputPerRequest * 0.75 - Math.min(m.maxOutputTokens, 2048))
      .map((m) => ({ m, s: score(m, this.quota.snapshot(m, now), estInputTokens, cls.intent, now) }))
      .filter((x) => x.s > -Infinity)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.m.id);
    const reason = chain.length ? `${cls.source}:${cls.intent}` : `${cls.source}:${cls.intent}:mock`;
    return { intent: cls.intent, chain: chain.length ? chain : ["mock:local"], contextPlan: "full", estInputTokens, reason };
  }

  /**
   * Stream an answer: try each model in the chain; on 429/5xx/timeout,
   * penalize and continue with the next, passing already-streamed text as an
   * assistant prefix so the user sees one continuous answer.
   */
  async *answer(cls: Classification, ctx: ContextInput, signal?: AbortSignal): AsyncGenerator<AnswerEvent> {
    const fixed = tokensOf([{ role: "system", content: ctx.system + (ctx.docs ?? "") + (ctx.web ?? "") + (ctx.profile ?? "") }]);
    const est = fixed + tokensOf(ctx.turns) + Math.ceil(ctx.summary.length / 3.5);
    const decision = this.route(cls, est, fixed);
    yield { type: "route", decision };
    const started = Date.now();
    let partial = "";
    let first = true;
    for (const id of decision.chain) {
      const m = this.byId.get(id)!;
      const adapter = m.providerId === "mock" ? this.adapters.mock : this.adapters[m.providerId];
      if (!adapter) continue;
      const fitted = fitContext(ctx, m, partial);
      if (m.providerId !== "mock" && !this.quota.reserve(m, tokensOf(fitted.messages))) continue;
      yield { type: "model", modelId: m.id, label: m.label, fallback: !first };
      first = false;
      const t0 = Date.now();
      try {
        for await (const chunk of adapter.stream(m, fitted.messages, { timeoutMs: 25_000, maxTokens: m.maxOutputTokens, signal })) {
          partial += chunk;
          yield { type: "delta", text: chunk };
        }
        this.quota.success(m, Date.now() - t0);
        this.opts.onEvent?.({ event: "route_ok", model: m.id, intent: cls.intent, ms: Date.now() - t0, plan: fitted.plan });
        yield { type: "done", modelId: m.id, label: m.label, ms: Date.now() - started, plan: fitted.plan, dropped: fitted.dropped };
        return;
      } catch (e) {
        const status = e instanceof ProviderError ? e.status : 0;
        this.quota.penalize(m, status, e instanceof ProviderError ? e.retryAfterMs : undefined);
        this.opts.onEvent?.({ event: "route_fallback", model: m.id, intent: cls.intent, status });
        if (signal?.aborted) return;
      }
    }
    // Never tell the user "limit reached"; just ask them to retry.
    const tail = partial ? "\n\n" + BUSY_TEXT : BUSY_TEXT;
    yield { type: "delta", text: tail };
    yield { type: "done", modelId: null, label: "Busy", ms: Date.now() - started, plan: "full", dropped: [] };
  }

  /** One-shot completion on the cheapest available model (summaries, profiles). */
  async complete(messages: ChatMessage[], maxTokens = 400): Promise<string | null> {
    for (const id of ["gemini:flash-lite", "groq:gpt-oss-20b", "groq:gpt-oss-120b", "gemini:gemma-31b"]) {
      const m = this.usable(id);
      if (!m || !this.quota.reserve(m, tokensOf(messages))) continue;
      try {
        let out = "";
        for await (const c of this.adapters[m.providerId]!.stream(m, fitContext({ system: messages[0]!.content, summary: "", turns: messages.slice(1) }, m).messages, { timeoutMs: 20_000, maxTokens })) {
          out += c;
          if (out.length > 6000) break;
        }
        this.quota.success(m, 0);
        return out.trim() || null;
      } catch (e) {
        if (e instanceof ProviderError) this.quota.penalize(m, e.status, e.retryAfterMs);
      }
    }
    return null;
  }
}
