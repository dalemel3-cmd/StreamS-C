"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LOCK_EVENT, isLocked } from "@/lib/rotateLock";
import { fadeIn, fadeOut } from "@/lib/transition";
import {
  SETTINGS_EVENT,
  isMenuOpen,
  loadScreens,
  loadSeconds,
  modeOf,
  nextScreenPath,
} from "@/lib/screenSettings";

type Router = ReturnType<typeof useRouter>;

const PAUSE_AFTER_KEY_MS = 2 * 60 * 1000;
const LAST_KEY = "rotate.last";
// Screens switch in-app, so the page itself never reloads. After this long, the next
// switch is a full page load instead, which picks up fresh code and settings.
const FULL_LOAD_AFTER_MS = 3 * 60 * 60 * 1000;
const loadedAt = Date.now();

/**
 * Auto-rotate to the next screen in screens.json after `seconds`. The page navigates
 * itself (not via the shell) so rotation works even when the app is holding an old or
 * default screen list. A page not in the list goes to the first screen.
 * Any key press pauses rotation for two minutes. `?rotate=0` turns it off.
 *
 * Guards: each page advances at most once, and if another advance happened less
 * than `seconds` ago (a stray timer from a page that was still loading), we wait instead.
 *
 * `skip` (e.g. the chosen sport has no marks here) moves on right away.
 * While locked (Up on the remote) or while the settings menu is open, neither happens.
 * Screens set to Off are skipped; a Stand-alone screen stays up with no rotation.
 *
 * Screens switch in-app with a short fade (no full page reload), and the next screen
 * is prefetched while this one is showing.
 */
export function useRotate(seconds: number, skip = false) {
  const router = useRouter();

  // This screen just mounted: fade it in and warm up the next one.
  useEffect(() => {
    fadeIn();
    loadScreens()
      .then((screens) => {
        // A stand-alone screen is set and this isn't it (e.g. the app just launched): go there now.
        const only = screens.find((s) => modeOf(s) === "only");
        if (only && only.path !== location.pathname)
          return goNext(router, only.path);
        const p = nextScreenPath(screens, location.pathname);
        if (p) router.prefetch(p);
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!skip || isLocked()) return;
    try {
      sessionStorage.setItem(LAST_KEY, String(Date.now()));
    } catch {}
    goNext(router).catch(() => {});
  }, [skip, router]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("rotate") === "0") return;
    // The menu's "Seconds per screen" overrides this screen's default.
    const period = () => (loadSeconds() ?? seconds) * 1000;
    let timer: ReturnType<typeof setTimeout>;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let done = false;

    const lastAdvance = () => {
      try {
        return Number(sessionStorage.getItem(LAST_KEY)) || 0;
      } catch {
        return 0;
      }
    };

    const next = async (retry = false): Promise<void> => {
      if (done) return;
      const periodMs = period();
      if (isLocked() || isMenuOpen()) return arm(periodMs);
      const since = Date.now() - lastAdvance();
      if (!retry && since >= 0 && since < periodMs * 0.9)
        return arm(periodMs - since);
      done = true;
      try {
        sessionStorage.setItem(LAST_KEY, String(Date.now()));
      } catch {}
      try {
        await goNext(router);
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
    const arm = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(next, ms);
    };
    // Up only toggles the lock; other keys (manual browsing) pause rotation for a while.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowUp") arm(PAUSE_AFTER_KEY_MS);
    };
    // Unlocking resumes the normal cycle from now.
    const onLock = (e: Event) => {
      if (!(e as CustomEvent<boolean>).detail) {
        done = false;
        arm(period());
      }
    };
    // A new time from the menu applies right away.
    const onSettings = () => {
      if (!done) arm(period());
    };
    arm(period());
    window.addEventListener("keydown", onKey);
    window.addEventListener(LOCK_EVENT, onLock);
    window.addEventListener(SETTINGS_EVENT, onSettings);
    return () => {
      clearTimeout(timer);
      clearTimeout(retryTimer);
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

/** Switch to `path` (or the next screen) with a fade. Exported for the settings menu. */
export async function goNext(router: Router, path?: string | null) {
  const target = path ?? (await nextPath());
  if (!target || target === location.pathname) return;
  await fadeOut();
  if (Date.now() - loadedAt > FULL_LOAD_AFTER_MS) {
    location.assign(target);
    return;
  }
  router.push(target);
  // If the switch stalls, don't leave the screen dark.
  setTimeout(fadeIn, 4000);
}
