// Per-TV choice for each screen: in rotation, off, or stand-alone (shown on its own, no rotation).
// Saved in localStorage so it survives app restarts on the stick.

export type Mode = "on" | "off" | "only";
export type ScreenEntry = {
  name: string;
  title?: string;
  path: string;
  default?: Mode;
};

const KEY = "screens.settings";
export const SETTINGS_EVENT = "screens-settings";
export const MODE_LABEL: Record<Mode, string> = {
  on: "In rotation",
  only: "Stand-alone",
  off: "Off",
};
export const NEXT_MODE: Record<Mode, Mode> = {
  on: "only",
  only: "off",
  off: "on",
};

export function loadSettings(): Record<string, Mode> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<
      string,
      Mode
    >;
  } catch {
    return {};
  }
}

export function saveSettings(s: Record<string, Mode>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT));
}

export function modeOf(s: ScreenEntry, settings = loadSettings()): Mode {
  return settings[s.path] ?? s.default ?? "on";
}

/** Set one screen's mode. Only one screen can be stand-alone at a time. */
export function withMode(
  screens: ScreenEntry[],
  settings: Record<string, Mode>,
  path: string,
  mode: Mode,
): Record<string, Mode> {
  const next = { ...settings, [path]: mode };
  if (mode === "only")
    for (const s of screens)
      if (s.path !== path && modeOf(s, next) === "only") next[s.path] = "on";
  return next;
}

/** Fetch screens.json (8 s timeout). */
export async function loadScreens(): Promise<ScreenEntry[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch("/screens.json", {
      cache: "no-store",
      signal: ctrl.signal,
    });
    return ((await res.json()) as { screens: ScreenEntry[] }).screens;
  } finally {
    clearTimeout(t);
  }
}

/** Where rotation goes next: the stand-alone screen if one is set, else the next screen that isn't off. Null = stay. */
export function nextScreenPath(
  screens: ScreenEntry[],
  current: string,
): string | null {
  const settings = loadSettings();
  const only = screens.find((s) => modeOf(s, settings) === "only");
  if (only) return only.path === current ? null : only.path;
  const i = screens.findIndex((s) => s.path === current);
  for (let k = 1; k <= screens.length; k++) {
    const s = screens[(Math.max(i, -1) + k + screens.length) % screens.length];
    if (modeOf(s, settings) === "on") return s.path === current ? null : s.path;
  }
  return null;
}

// Seconds each screen stays up. null = each screen's own default (20-25 s).
const SECONDS_KEY = "rotate.seconds";
export const SECONDS_STEPS: (number | null)[] = [
  null,
  10,
  15,
  20,
  30,
  45,
  60,
  90,
];

export function loadSeconds(): number | null {
  try {
    const v = Number(localStorage.getItem(SECONDS_KEY));
    return SECONDS_STEPS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveSeconds(v: number | null) {
  try {
    if (v == null) localStorage.removeItem(SECONDS_KEY);
    else localStorage.setItem(SECONDS_KEY, String(v));
  } catch {}
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT));
}

export const secondsLabel = (v: number | null) =>
  v == null ? "Default" : `${v} sec`;

let menuOpen = false;
export const isMenuOpen = () => menuOpen;
export const setMenuOpen = (v: boolean) => {
  menuOpen = v;
};
