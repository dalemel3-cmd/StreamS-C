"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LOCK_EVENT, isLocked } from "@/lib/rotateLock";
import { fadeIn, fadeOut } from "@/lib/transition";
import { setStepHandler } from "@/lib/tv";
import {
  SETTINGS_EVENT,
  type ScreenEntry,
  isMenuOpen,
  loadScreens,
  loadSeconds,
  modeOf,
  nextScreenPath,
  stepScreenPath,
} from "@/lib/screenSettings";

type Router = ReturnType<typeof useRouter>;

export type RotateProgressState = {
  durationMs: number | null;
  key: number;
};

export const ROTATE_PROGRESS_EVENT = "rotate-progress";

const PAUSE_AFTER_KEY_MS = 2 * 60 * 1000;
const LAST_KEY = "rotate.last";
const SKIPS_KEY = "rotate.skips";
// Screens switch in-app, so the page itself never reloads. After this long, the next
// switch is a full page load instead, which picks up fresh code and settings.
const FULL_LOAD_AFTER_MS = 3 * 60 * 60 * 1000;
const loadedAt = Date.now();
let progressSeq = 0;

function emitProgress(durationMs: number | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RotateProgressState>(ROTATE_PROGRESS_EVENT, {
      detail: { durationMs, key: ++progressSeq },
    }),
  );
}

function readSkips(): number {
  try {
    return Number(sessionStorage.getItem(SKIPS_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeSkips(n: number) {
  try {
    if (n <= 0) sessionStorage.removeItem(SKIPS_KEY);
    else sessionStorage.setItem(SKIPS_KEY, String(n));
  } catch {}
}

/**
 * Auto-rotate to the next screen in screens.json after `seconds`. The page navigates
 * itself (not via the shell) so rotation works even when the app is holding an old or
 * default screen list. A page not in the list goes to the first screen.
 * Any key press pauses rotation for two minutes. `?rotate=0` turns it off.
 *
 * Guards: each page advances at most once, and if another advance happened less
 * than `seconds` ago (a stray timer from a page that was still loading), we wait instead.
 *
 * `skip` (e.g. the chosen sport has no marks here) moves on right away (capped so an
 * empty sport never loops infinitely).
 * While locked (Up on the remote) or while the settings menu is open, neither happens.
 * Screens set to Off are skipped; a Stand-alone screen stays up with no rotation.
 *
 * Screens switch in-app with a short fade (no full page reload), and the next screen
 * is prefetched while this one is showing.
 */
export function useRotate(seconds: number, skip = false) {
  const router = useRouter();

  // This screen just mounted: fade it in, sync the APK's index, and handle Left/Right in-app.
  useEffect(() => {
    fadeIn();
    try {
      window.MasonTV?.syncPath?.(location.pathname);
    } catch {}

    let cachedScreens: ScreenEntry[] | null = null;
    loadScreens()
      .then((screens) => {
        cachedScreens = screens;
        // A stand-alone screen is set and this isn't it (e.g. the app just launched): go there now.
        const only = screens.find((s) => modeOf(s) === "only");
        if (only && only.path !== location.pathname)
          return goNext(router, only.path);
        const p = nextScreenPath(screens, location.pathname);
        if (p) router.prefetch(p);
      })
      .catch(() => {});

    setStepHandler((delta) => {
      if (isMenuOpen()) return true;
      writeSkips(0);
      const run = async () => {
        const list = cachedScreens ?? (await loadScreens().catch(() => null));
        if (!list) {
          if (delta >= 0) window.MasonTV?.nextScreen();
          else window.MasonTV?.prevScreen();
          return;
        }
        cachedScreens = list;
        const target = stepScreenPath(list, location.pathname, delta);
        if (target) {
          try {
            sessionStorage.setItem(LAST_KEY, String(Date.now()));
          } catch {}
          await goNext(router, target);
        }
      };
      void run();
      return true;
    });

    return () => setStepHandler(null);
  }, [router]);

  useEffect(() => {
    if (!skip) {
      writeSkips(0);
      return;
    }
    if (isLocked() || isMenuOpen()) return;
    loadScreens()
      .then((screens) => {
        if (isLocked() || isMenuOpen()) return;
        const skips = readSkips();
        if (skips >= screens.length) return;
        writeSkips(skips + 1);
        try {
          sessionStorage.setItem(LAST_KEY, String(Date.now()));
        } catch {}
        return goNext(router);
      })
      .catch(() => {});
  }, [skip, router]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("rotate") === "0") {
      emitProgress(null);
      return;
    }
    // The menu's "Seconds per screen" overrides this screen's default.
    const period = () => (loadSeconds() ?? seconds) * 1000;
    let timer: ReturnType<typeof setTimeout>;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    let canAdvance = true;
    let active = true;

    const lastAdvance = () => {
      try {
        return Number(sessionStorage.getItem(LAST_KEY)) || 0;
      } catch {
        return 0;
      }
    };

    const arm = (ms: number, showBar = true) => {
      clearTimeout(timer);
      if (!active) return;
      if (!canAdvance || isLocked() || isMenuOpen()) {
        emitProgress(null);
        return;
      }
      emitProgress(showBar ? ms : null);
      timer = setTimeout(() => void next(false), ms);
    };

    const syncCanAdvance = () => {
      loadScreens()
        .then((screens) => {
          if (!active) return;
          canAdvance = nextScreenPath(screens, location.pathname) !== null;
          if (!canAdvance) {
            clearTimeout(timer);
            emitProgress(null);
          } else if (!done && !isLocked() && !isMenuOpen()) {
            arm(period());
          }
        })
        .catch(() => {});
    };

    const next = async (retry = false): Promise<void> => {
      if (done || !active) return;
      const periodMs = period();
      if (isLocked() || isMenuOpen()) {
        emitProgress(null);
        return;
      }
      const since = Date.now() - lastAdvance();
      if (!retry && since >= 0 && since < periodMs * 0.9)
        return arm(periodMs - since);
      done = true;
      emitProgress(null);
      try {
        sessionStorage.setItem(LAST_KEY, String(Date.now()));
      } catch {}
      try {
        const moved = await goNext(router);
        if (!active) return;
        if (!moved) {
          // Stand-alone screen or no other screens enabled: stay put without polling.
          done = false;
          canAdvance = false;
          emitProgress(null);
          return;
        }
        // Still here 15 s after navigating (slow or failed load): try again.
        retryTimer = setTimeout(() => {
          done = false;
          void next(true);
        }, 15000);
      } catch {
        // screens.json didn't load or hung: try again shortly instead of stalling on this screen.
        done = false;
        clearTimeout(timer);
        timer = setTimeout(() => void next(true), 5000);
      }
    };

    // Up only toggles the lock; other keys (manual browsing) pause rotation for a while.
    const onKey = (e: KeyboardEvent) => {
      writeSkips(0);
      if (e.key !== "ArrowUp" && !isMenuOpen()) arm(PAUSE_AFTER_KEY_MS, false);
    };
    // Locking pauses rotation and hides the bar; unlocking resumes the normal cycle.
    const onLock = (e: Event) => {
      const locked = Boolean((e as CustomEvent<boolean>).detail);
      if (locked) {
        clearTimeout(timer);
        emitProgress(null);
      } else {
        done = false;
        arm(period());
      }
    };
    // Settings menu open/close or new seconds/mode applies right away.
    const onSettings = () => {
      if (isMenuOpen()) {
        clearTimeout(timer);
        emitProgress(null);
        return;
      }
      done = false;
      syncCanAdvance();
    };

    syncCanAdvance();
    window.addEventListener("keydown", onKey);
    window.addEventListener(LOCK_EVENT, onLock);
    window.addEventListener(SETTINGS_EVENT, onSettings);
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(retryTimer);
      emitProgress(null);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(LOCK_EVENT, onLock);
      window.removeEventListener(SETTINGS_EVENT, onSettings);
    };
  }, [seconds, router]);
}

/** Next screen per screens.json and this TV's settings (null = stay on this one). */
async function nextPath(): Promise<string | null> {
  return nextScreenPath(await loadScreens(), location.pathname);
}

/** Switch to `path` (or the next screen) with a fade. Returns true if navigation started. */
export async function goNext(
  router: Router,
  path?: string | null,
): Promise<boolean> {
  const target = path ?? (await nextPath());
  if (!target || target === location.pathname) return false;
  await fadeOut();
  if (Date.now() - loadedAt > FULL_LOAD_AFTER_MS) {
    location.assign(target);
    return true;
  }
  router.push(target);
  // If the switch stalls, don't leave the screen dark.
  setTimeout(fadeIn, 4000);
  return true;
}
