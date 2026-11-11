import type { Intent, ModelCapability, ProviderId } from "./types";

/**
 * Free-tier model pool (limits from the design Page, checked 10 Nov 2026).
 * Model ids are env-overridable (MODEL_<ID> e.g. MODEL_GROQ_GPT_OSS_120B)
 * because free models change. To add a model: append one entry and put its
 * id into ROUTE_TABLE chains.
 */
type Def = Omit<ModelCapability, "model"> & { defaultModel: string };

const M = (
  id: string, providerId: ProviderId, defaultModel: string, label: string,
  intents: Intent[], quality: Partial<Record<Intent, number>>,
  limits: { rpm: number; rpd: number; tpm: number }, contextTokens: number, maxOutputTokens = 2048,
): Def => ({
  id, providerId, defaultModel, label, intents, quality, limits, contextTokens, maxOutputTokens,
  maxInputPerRequest: Math.min(contextTokens, limits.tpm),
});

const ALL: Intent[] = ["chat", "code", "reasoning", "long_doc", "image_gen", "video_gen", "vision", "office_doc", "web", "translate_summarize", "quick"];

const DEFS: Def[] = [
  // Groq: fastest. 30 RPM, 1K RPD, 8K TPM per model.
  M("groq:gpt-oss-120b", "groq", "openai/gpt-oss-120b", "Groq", ["chat", "code", "reasoning", "office_doc", "web", "translate_summarize", "long_doc", "image_gen", "video_gen"],
    { chat: 0.85, code: 0.8, reasoning: 0.8, office_doc: 0.75, web: 0.7, translate_summarize: 0.6, long_doc: 0.5, image_gen: 0.5, video_gen: 0.5 }, { rpm: 30, rpd: 1000, tpm: 8000 }, 128_000),
  M("groq:gpt-oss-20b", "groq", "openai/gpt-oss-20b", "Groq", ["quick", "chat", "code"], { quick: 0.9, chat: 0.6, code: 0.5 }, { rpm: 30, rpd: 1000, tpm: 8000 }, 128_000, 1024),
  M("groq:qwen", "groq", "qwen/qwen3.8-27b", "Groq Qwen", ["code", "chat"], { code: 0.7, chat: 0.55 }, { rpm: 30, rpd: 1000, tpm: 8000 }, 128_000),
  // Google AI Studio.
  M("gemini:flash-lite", "gemini", "gemini-3.5-flash-lite", "Gemini", ["chat", "long_doc", "office_doc", "translate_summarize", "web", "vision", "quick", "code", "image_gen", "video_gen"],
    { chat: 0.8, long_doc: 0.9, office_doc: 0.85, translate_summarize: 0.9, web: 0.75, vision: 0.85, quick: 0.6, code: 0.65, image_gen: 0.45, video_gen: 0.45 }, { rpm: 15, rpd: 500, tpm: 250_000 }, 1_000_000, 4096),
  M("gemini:flash", "gemini", "gemini-3.8-flash", "Gemini Flash", ["code", "reasoning", "long_doc"], { code: 0.95, reasoning: 0.95, long_doc: 0.85 }, { rpm: 5, rpd: 20, tpm: 250_000 }, 1_000_000, 8192),
  M("gemini:gemma-31b", "gemini", "gemma-4-31b-it", "Gemma", ["chat", "office_doc", "translate_summarize", "quick", "reasoning"],
    { chat: 0.65, office_doc: 0.6, translate_summarize: 0.75, quick: 0.55, reasoning: 0.5 }, { rpm: 30, rpd: 14_400, tpm: 16_000 }, 256_000),
  M("gemini:gemma-26b", "gemini", "gemma-4-26b-a4b-it", "Gemma", ["quick", "chat"], { quick: 0.7, chat: 0.5 }, { rpm: 30, rpd: 14_400, tpm: 16_000 }, 256_000, 1024),
  // OpenRouter :free models share 20 RPM / 50 RPD per account.
  M("openrouter:nemotron-ultra", "openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free", "OpenRouter", ["reasoning", "chat"], { reasoning: 0.85, chat: 0.6 }, { rpm: 20, rpd: 50, tpm: 1_000_000 }, 64_000),
  M("openrouter:north-code", "openrouter", "cohere/north-mini-code:free", "OpenRouter", ["code"], { code: 0.75 }, { rpm: 20, rpd: 50, tpm: 1_000_000 }, 64_000),
  M("openrouter:nemotron-vl", "openrouter", "nvidia/nemotron-3.5-super-vl:free", "OpenRouter", ["vision", "chat"], { vision: 0.7, chat: 0.5 }, { rpm: 20, rpd: 50, tpm: 1_000_000 }, 128_000),
  M("openrouter:gemma-31b", "openrouter", "google/gemma-4-31b-it:free", "OpenRouter", ["chat", "quick", "translate_summarize"], { chat: 0.6, quick: 0.5, translate_summarize: 0.6 }, { rpm: 20, rpd: 50, tpm: 1_000_000 }, 128_000),
  M("openrouter:nemotron-lightning", "openrouter", "nvidia/nemotron-3.5-lightning:free", "OpenRouter", ["long_doc", "chat"], { long_doc: 0.7, chat: 0.55 }, { rpm: 20, rpd: 50, tpm: 1_000_000 }, 128_000),
  // Cloudflare Workers AI: 10K neurons/day (~90 chat replies).
  M("cloudflare:llama-70b", "cloudflare", "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "Cloudflare", ["chat", "quick"], { chat: 0.6, quick: 0.5 }, { rpm: 60, rpd: 90, tpm: 100_000 }, 24_000),
  // SambaNova free tier: ~20 RPM, 20 RPD per model. Ids from /v1/models (11 Nov 2026).
  M("sambanova:gpt-oss-120b", "sambanova", "gpt-oss-120b", "SambaNova", ["chat", "reasoning", "code", "web", "office_doc", "long_doc"],
    { chat: 0.7, reasoning: 0.75, code: 0.65, web: 0.6, office_doc: 0.6, long_doc: 0.5 }, { rpm: 20, rpd: 20, tpm: 100_000 }, 128_000),
  M("sambanova:llama-70b", "sambanova", "Meta-Llama-3.3-70B-Instruct", "SambaNova", ["chat", "quick", "translate_summarize"], { chat: 0.55, quick: 0.5, translate_summarize: 0.55 }, { rpm: 20, rpd: 20, tpm: 100_000 }, 128_000),
  // Cohere trial: 20 RPM chat, 1,000 calls/month (~33/day). Last resort. Ids from /v1/models.
  M("cohere:command-a", "cohere", "command-a-plus-05-2026", "Cohere", ["office_doc", "chat", "long_doc", "web", "vision"], { office_doc: 0.6, chat: 0.45, long_doc: 0.55, web: 0.5, vision: 0.5 }, { rpm: 20, rpd: 33, tpm: 400_000 }, 400_000),
  M("cohere:r7b", "cohere", "command-r7b-12-2024", "Cohere", ["quick", "chat"], { quick: 0.4, chat: 0.3 }, { rpm: 20, rpd: 33, tpm: 128_000 }, 128_000, 1024),
  // Z.AI GLM-4.7-Flash: the free model (not in /models, but answers; glm-5.x needs a paid balance).
  M("zai:glm-flash", "zai", "glm-4.7-flash", "GLM", ["chat", "quick", "web"], { chat: 0.5, quick: 0.45, web: 0.45 }, { rpm: 3, rpd: 1000, tpm: 100_000 }, 128_000),
  // Offline demo provider.
  M("mock:local", "mock", "mock", "Mock", ALL, {}, { rpm: 1000, rpd: 100_000, tpm: 1_000_000 }, 32_000, 1024),
];

const VISION = new Set(["gemini:flash-lite", "gemini:flash", "openrouter:nemotron-vl", "cohere:command-a"]);

const envKey = (id: string) => "MODEL_" + id.replace(/[^a-z0-9]+/gi, "_").toUpperCase();

export function buildModels(env: Record<string, string | undefined> = process.env): ModelCapability[] {
  return DEFS.map(({ defaultModel, ...d }) => ({ ...d, vision: VISION.has(d.id), model: env[envKey(d.id)] || defaultModel }));
}

/** Static chains per intent: primary first, then fallbacks. The scorer reorders at runtime. */
export const ROUTE_TABLE: Record<Intent, string[]> = {
  chat: ["groq:gpt-oss-120b", "gemini:flash-lite", "gemini:gemma-31b", "cloudflare:llama-70b", "openrouter:nemotron-ultra", "openrouter:gemma-31b", "sambanova:gpt-oss-120b", "zai:glm-flash", "cohere:command-a"],
  quick: ["groq:gpt-oss-20b", "gemini:gemma-26b", "cloudflare:llama-70b", "openrouter:gemma-31b", "gemini:flash-lite", "sambanova:llama-70b", "zai:glm-flash", "cohere:r7b"],
  code: ["gemini:flash", "groq:gpt-oss-120b", "openrouter:north-code", "groq:qwen", "gemini:flash-lite", "sambanova:gpt-oss-120b"],
  reasoning: ["gemini:flash", "groq:gpt-oss-120b", "openrouter:nemotron-ultra", "sambanova:gpt-oss-120b"],
  long_doc: ["gemini:flash-lite", "gemini:flash", "openrouter:nemotron-lightning", "openrouter:nemotron-ultra", "groq:gpt-oss-120b", "cohere:command-a", "sambanova:gpt-oss-120b"],
  office_doc: ["gemini:flash-lite", "groq:gpt-oss-120b", "gemini:gemma-31b", "sambanova:gpt-oss-120b", "cohere:command-a"],
  web: ["gemini:flash-lite", "groq:gpt-oss-120b", "cloudflare:llama-70b", "openrouter:nemotron-ultra", "zai:glm-flash", "sambanova:gpt-oss-120b", "cohere:command-a"],
  translate_summarize: ["gemini:flash-lite", "gemini:gemma-31b", "openrouter:gemma-31b", "groq:gpt-oss-120b", "sambanova:llama-70b"],
  vision: ["gemini:flash-lite", "gemini:flash", "openrouter:nemotron-vl", "cohere:command-a"],
  // Images come from Cloudflare/Pollinations; these models only write the caption.
  image_gen: ["groq:gpt-oss-20b", "groq:gpt-oss-120b", "gemini:flash-lite", "cloudflare:llama-70b"],
  video_gen: ["groq:gpt-oss-120b", "gemini:flash-lite", "cloudflare:llama-70b"],
};
