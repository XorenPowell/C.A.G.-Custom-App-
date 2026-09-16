/**
 * The editable theme tokens (Appearance settings). Mirrors the @theme block
 * in globals.css exactly — those are the shipped defaults; this file is the
 * single source of truth for which tokens are user-editable, their labels,
 * and their grouping in the Appearance screen.
 *
 * Font family and radius tokens are deliberately not here — spec says only
 * colors are user-editable in this pass.
 */

export type ThemeToken = { key: string; label: string; default: string };
export type ThemeTokenGroup = { group: string; tokens: ThemeToken[] };

export const THEME_TOKEN_GROUPS: ThemeTokenGroup[] = [
  {
    group: "Backgrounds",
    tokens: [
      { key: "--bg", label: "Background", default: "#17191c" },
      { key: "--panel", label: "Panel", default: "#1e2124" },
      { key: "--panel-raised", label: "Panel (raised)", default: "#26292d" },
      { key: "--border", label: "Border", default: "#2e3237" },
    ],
  },
  {
    group: "Text",
    tokens: [
      { key: "--text", label: "Text", default: "#f2f2f0" },
      { key: "--text-muted", label: "Text (muted)", default: "#9a9da2" },
      { key: "--text-faint", label: "Text (faint)", default: "#6b6e73" },
    ],
  },
  {
    group: "Pills",
    tokens: [
      { key: "--pill-bg", label: "Pill background", default: "#24272b" },
      { key: "--pill-active-bg", label: "Pill background (active)", default: "#34383d" },
      { key: "--pill-border", label: "Pill border", default: "#34383d" },
      { key: "--pill-active-border", label: "Pill border (active)", default: "#454a50" },
    ],
  },
  {
    group: "Accents",
    tokens: [
      { key: "--live", label: "Live indicator", default: "#ff7a33" },
      { key: "--money", label: "Money figures", default: "#e8e6e1" },
    ],
  },
  {
    group: "Hero Gradient",
    tokens: [
      { key: "--hero-a", label: "Gradient stop 1", default: "#0f3238" },
      { key: "--hero-b", label: "Gradient stop 2", default: "#29233a" },
      { key: "--hero-c", label: "Gradient stop 3", default: "#43203a" },
    ],
  },
];

export const THEME_TOKEN_KEYS: ReadonlySet<string> = new Set(
  THEME_TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.key)),
);

export const THEME_DEFAULTS: Record<string, string> = Object.fromEntries(
  THEME_TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => [t.key, t.default])),
);

/** Native `<input type="color">` only round-trips 6-digit hex reliably. */
export function isValidColorValue(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v.trim());
}

/** Only known tokens with valid hex values survive — silently drops the rest. */
export function sanitizeThemeOverrides(overrides: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (THEME_TOKEN_KEYS.has(key) && isValidColorValue(value)) {
      clean[key] = value.trim().toLowerCase();
    }
  }
  return clean;
}

/** Builds the `:root { --token: value; ... }` CSS text for the current overrides. */
export function buildOverrideCss(overrides: Record<string, string>): string {
  const clean = sanitizeThemeOverrides(overrides);
  const entries = Object.entries(clean);
  if (entries.length === 0) return "";
  const body = entries.map(([k, v]) => `${k}:${v};`).join("");
  return `:root{${body}}`;
}
