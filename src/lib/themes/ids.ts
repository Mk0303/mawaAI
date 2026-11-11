/** Theme ids: shared by server (validation, persistence) and client (rendering). */
export const THEME_IDS = ["savage", "nature", "dogs", "horses", "cosmic", "mountains", "mani", "calm"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = "savage";
export const isThemeId = (x: unknown): x is ThemeId => typeof x === "string" && (THEME_IDS as readonly string[]).includes(x);
