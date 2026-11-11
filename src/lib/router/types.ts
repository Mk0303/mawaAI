export type Intent =
  | "chat" | "code" | "reasoning" | "long_doc" | "image_gen" | "video_gen" | "vision"
  | "office_doc" | "web" | "translate_summarize" | "quick";

export const INTENTS: readonly Intent[] = [
  "chat", "code", "reasoning", "long_doc", "image_gen", "video_gen", "vision",
  "office_doc", "web", "translate_summarize", "quick",
] as const;

/** UI category chips map onto intents (a hint, not a hard override). */
export const CATEGORY_TO_INTENT = {
  chat: "chat", code: "code", docs: "office_doc", image: "image_gen", video: "video_gen", search: "web",
} as const satisfies Record<string, Intent>;
export type Category = keyof typeof CATEGORY_TO_INTENT;

export type ProviderId =
  | "groq" | "gemini" | "openrouter" | "cloudflare" | "sambanova" | "cohere" | "zai" | "mock";

export interface ModelCapability {
  id: string;                 // "groq:openai/gpt-oss-120b"
  providerId: ProviderId;
  model: string;              // id sent to the provider
  label: string;              // short name for the badge
  intents: Intent[];
  contextTokens: number;
  maxInputPerRequest: number; // min(window, TPM)
  maxOutputTokens: number;
  limits: { rpm: number; rpd: number; tpm: number };
  quality: Partial<Record<Intent, number>>; // 0..1
  vision?: boolean;           // accepts image input
}

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string; images?: string[] /* data: URLs, user role only */ }

export interface Classification {
  intent: Intent;
  needsLongContext: boolean;
  needsVision?: boolean;
  confidence: number;
  sensitive: boolean;
  source: "rules" | "llm" | "category" | "default";
}

export interface RouteDecision {
  intent: Intent;
  chain: string[];
  contextPlan: "full" | "trimmed" | "summarized";
  estInputTokens: number;
  reason: string;
}

export interface StreamOptions { timeoutMs: number; maxTokens: number; signal?: AbortSignal; json?: boolean }

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  available(): boolean;
  stream(m: ModelCapability, messages: ChatMessage[], opts: StreamOptions): AsyncIterable<string>;
}

/** Errors adapters throw so the router can penalize and fall back. */
export class ProviderError extends Error {
  constructor(public status: number, public retryAfterMs?: number, msg = "provider_error") {
    super(msg);
  }
}
