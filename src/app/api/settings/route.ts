import { z } from "zod";
import { api, jsonError, readJson, BodyTooLarge } from "@/lib/http";
import { getStore } from "@/lib/db";
import { THEME_IDS } from "@/lib/themes/ids";
import { GAME_IDS } from "@/lib/sendgames/games";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Care mode is not a setting: it is always on, enforced server-side.
// Partial update: send only what changed.
const Body = z.object({ vibe: z.enum(["chill", "sarcastic", "full_roast"]).optional(), mawa: z.boolean().optional(), theme: z.enum(THEME_IDS).optional(),
  sendGames: z.object({ mode: z.enum(["surprise", "favorites", "fixed", "off"]), favorites: z.array(z.enum(GAME_IDS)).max(GAME_IDS.length), fixed: z.enum(GAME_IDS).nullable() }).strict().optional() })
  .strict().refine((b) => Object.keys(b).length > 0);

export const GET = api(async (_req, u) => Response.json({ ...getStore().getSettings(u.userId), care: true }));

export const PUT = api(async (req, u) => {
  let raw: unknown;
  try { raw = await readJson(req, 2_000); } catch (e) { if (e instanceof BodyTooLarge) return jsonError(413, "Too big.", u.reqId); throw e; }
  const p = Body.safeParse(raw);
  if (!p.success) return jsonError(400, "Invalid settings.", u.reqId);
  const store = getStore();
  return Response.json({ ...store.saveSettings(u.userId, { ...store.getSettings(u.userId), ...p.data }), care: true });
}, { maxBodyBytes: 2_000 });
