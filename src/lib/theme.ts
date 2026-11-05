/**
 * The editable theme tokens (Appearance settings). This file owns which
 * tokens are user-editable, their labels and their grouping in the
 * Appearance screen — globals.css's @theme block still owns the tokens
 * themselves and is what actually renders app-wide.
 *
 * The `default` value on each token is a plain duplicate of that token's
 * value in globals.css, needed here only so the Appearance screen has
 * something to show/reset to before an override exists. **If you change a
 * default in globals.css, change it here too** — same rule this codebase
 * already applies to job_financials.sql vs calc.ts.
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
    group: "Surface wash (Aurora)",
    tokens: [
      { key: "--hero-a", label: "Wash 1", default: "#0f3238" },
      { key: "--hero-b", label: "Wash 2", default: "#29233a" },
      { key: "--hero-c", label: "Wash 3", default: "#43203a" },
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

export type Preset = { id: string; label: string; hint: string };

export const SURFACE_PRESETS: Preset[] = [
  { id: "blend",   label: "Grey blend",      hint: "Soft light from the top-left over fine grain. The default." },
  { id: "flat",    label: "Flat",            hint: "Plain colour. Nothing between you and the data." },
  { id: "grain",   label: "Film grain",      hint: "Fine static. Takes the plastic edge off a flat dark panel." },
  { id: "grid",    label: "Blueprint",       hint: "Faint 34px rule. Reads as drafting paper." },
  { id: "dots",    label: "Dot matrix",      hint: "A whisper of a dot grid, like engineering pad." },
  { id: "aurora",  label: "Aurora",          hint: "Soft colour wash in the corners, drawn from the hero gradient." },
  { id: "weave",   label: "Diagonal weave",  hint: "45-degree hatching. Closest to a textile." },
  { id: "vignette",label: "Vignette",        hint: "Light pools at the top, falls away at the edges." },
];

export const ELEVATION_PRESETS: Preset[] = [
  { id: "none",   label: "None",   hint: "Borders only." },
  { id: "soft",   label: "Soft",   hint: "Just enough to lift a card off the page." },
  { id: "lifted", label: "Lifted", hint: "A clear step up. Panels read as cards." },
  { id: "deep",   label: "Deep",   hint: "Strong separation. Best on the darkest backgrounds." },
];

const SURFACE_IDS = new Set(SURFACE_PRESETS.map((p) => p.id));
const ELEVATION_IDS = new Set(ELEVATION_PRESETS.map((p) => p.id));

/** Only known tokens with valid hex values survive — silently drops the rest. */
export function sanitizeThemeOverrides(overrides: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (THEME_TOKEN_KEYS.has(key) && isValidColorValue(value)) {
      clean[key] = value.trim().toLowerCase();
    }
  }
  // Surface and elevation are preset ids, not colours. An unrecognised id is
  // dropped rather than stored, so a stale or hand-edited value can never
  // leave the app with no texture rule to match.
  if (overrides.surface && SURFACE_IDS.has(overrides.surface)) {
    clean.surface = overrides.surface;
  }
  if (overrides.elevation && ELEVATION_IDS.has(overrides.elevation)) {
    clean.elevation = overrides.elevation;
  }
  return clean;
}

/** Builds the `:root { --token: value; ... }` CSS text for the current overrides. */
export function buildOverrideCss(overrides: Record<string, string>): string {
  const clean = sanitizeThemeOverrides(overrides);
  // Only real custom properties belong in :root; surface/elevation are
  // applied as data attributes on <body> instead.
  const entries = Object.entries(clean).filter(([k]) => k.startsWith("--"));
  if (entries.length === 0) return "";
  const body = entries.map(([k, v]) => `${k}:${v};`).join("");
  return `:root{${body}}`;
}


/* ---------------------------------------------------------------------
 * Surface and elevation
 *
 * These are presets, not free values: the texture CSS lives in globals.css
 * behind a data attribute rather than being stored as a CSS string, so a
 * saved setting can never inject arbitrary CSS and the textures stay
 * readable, editable code.
 * ------------------------------------------------------------------- */

export const SURFACE_KEY = "surface";
export const ELEVATION_KEY = "elevation";
export const DEFAULT_SURFACE = "blend";
export const DEFAULT_ELEVATION = "soft";


export function readSurface(overrides: Record<string, string> | null | undefined): string {
  const v = overrides?.[SURFACE_KEY];
  return v && SURFACE_IDS.has(v) ? v : DEFAULT_SURFACE;
}

export function readElevation(overrides: Record<string, string> | null | undefined): string {
  const v = overrides?.[ELEVATION_KEY];
  return v && ELEVATION_IDS.has(v) ? v : DEFAULT_ELEVATION;
}
