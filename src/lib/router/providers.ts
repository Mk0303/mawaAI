import type { ProviderId } from "./types";

/**
 * Provider catalogue. Adding a provider = one entry here + its models in
 * registry.ts. Every chat provider below speaks the OpenAI chat format, so
 * one adapter class covers all of them. Keys are read server-side only.
 */
export interface ProviderDef {
  id: Exclude<ProviderId, "mock">;
  label: string;
  /** Base URL up to (not including) /chat/completions. May use {ACCOUNT_ID}. */
  baseUrl: string;
  apiKeyEnv: string;
  extraEnv?: string[];        // other required env vars (e.g. account id)
  extraHeaders?: Record<string, string>;
  dailyReset: "utc_midnight" | "pacific_midnight" | "monthly";
  signupUrl: string;
}

export const PROVIDERS: ProviderDef[] = [
  { id: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", apiKeyEnv: "GROQ_API_KEY", dailyReset: "utc_midnight", signupUrl: "https://console.groq.com/keys" },
  { id: "gemini", label: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", apiKeyEnv: "GEMINI_API_KEY", dailyReset: "pacific_midnight", signupUrl: "https://aistudio.google.com/apikey" },
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", apiKeyEnv: "OPENROUTER_API_KEY", extraHeaders: { "X-Title": "Mawa AI" }, dailyReset: "utc_midnight", signupUrl: "https://openrouter.ai/settings/keys" },
  { id: "cloudflare", label: "Cloudflare", baseUrl: "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1", apiKeyEnv: "CLOUDFLARE_API_TOKEN", extraEnv: ["CLOUDFLARE_ACCOUNT_ID"], dailyReset: "utc_midnight", signupUrl: "https://dash.cloudflare.com/profile/api-tokens" },
  { id: "sambanova", label: "SambaNova", baseUrl: "https://api.sambanova.ai/v1", apiKeyEnv: "SAMBANOVA_API_KEY", dailyReset: "utc_midnight", signupUrl: "https://cloud.sambanova.ai/apis" },
  { id: "cohere", label: "Cohere", baseUrl: "https://api.cohere.ai/compatibility/v1", apiKeyEnv: "COHERE_API_KEY", dailyReset: "monthly", signupUrl: "https://dashboard.cohere.com/api-keys" },
  { id: "zai", label: "Z.AI", baseUrl: "https://api.z.ai/api/paas/v4", apiKeyEnv: "ZAI_API_KEY", dailyReset: "utc_midnight", signupUrl: "https://z.ai/manage-apikey/apikey-list" },
];

export function providerDef(id: ProviderId): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Resolve key + URL from env; null when not configured. Server-side only. */
export function resolveProvider(def: ProviderDef, env: Record<string, string | undefined> = process.env): { url: string; key: string } | null {
  const key = env[def.apiKeyEnv];
  if (!key || key.length < 10) return null;
  let url = def.baseUrl;
  for (const extra of def.extraEnv ?? []) {
    const v = env[extra];
    if (!v || !/^[A-Za-z0-9_-]{6,64}$/.test(v)) return null; // strict: it lands in a URL path
    url = url.replace("{ACCOUNT_ID}", v);
  }
  return { url, key };
}
