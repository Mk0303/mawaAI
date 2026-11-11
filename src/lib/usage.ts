import "server-only";
import { getStore } from "./db";
import type { UsageKind } from "./db/store";

/**
 * Per-user daily soft limits (reset at midnight IST) so one friend can't
 * drain the shared free quota. Override with SOFT_LIMIT_<KIND>=n.
 */
const DEFAULTS: Record<UsageKind, number> = { chat: 250, image: 15, search: 40, voice: 60, upload: 25 };

export function limitFor(kind: UsageKind): number {
  const v = Number(process.env[`SOFT_LIMIT_${kind.toUpperCase()}`]);
  return Number.isInteger(v) && v > 0 ? v : DEFAULTS[kind];
}

/** Returns true and counts the use if under the limit; false if the user is over today. */
export function takeQuota(userId: string, kind: UsageKind): boolean {
  const s = getStore();
  if (s.getUsage(userId, kind) >= limitFor(kind)) return false;
  s.bumpUsage(userId, kind);
  return true;
}

export const OVER_LIMIT_TEXT: Record<UsageKind, string> = {
  chat: "You've talked my ear off today, mawa. Daily limit hit; I'm back after midnight.",
  image: "That's your image quota for today, Picasso. More after midnight.",
  search: "No more web searches today. Google is still free, I hear.",
  voice: "My ears are done for today. Type it out, or try again after midnight.",
  upload: "Enough files for one day. Upload more after midnight.",
};
