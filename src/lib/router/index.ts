import "server-only";
import { buildModels } from "./registry";
import { MemoryQuota } from "./quota";
import { Router } from "./router";
import { PROVIDERS } from "./providers";
import { OpenAICompatibleAdapter } from "../providers/openai-compatible";
import { MockAdapter } from "../providers/mock";
import type { ProviderAdapter, ProviderId } from "./types";
import { getEnv } from "../env";
import { log } from "../log";

const g = globalThis as unknown as { __mawaRouter?: Router };

export function getRouter(): Router {
  if (g.__mawaRouter) return g.__mawaRouter;
  const adapters: Partial<Record<ProviderId, ProviderAdapter>> = { mock: new MockAdapter() };
  for (const p of PROVIDERS) adapters[p.id] = new OpenAICompatibleAdapter(p.id);
  g.__mawaRouter = new Router(buildModels(), adapters, new MemoryQuota(), {
    llmClassifier: getEnv().llmClassifier,
    onEvent: (e) => log("info", String(e.event), e),
  });
  return g.__mawaRouter;
}
