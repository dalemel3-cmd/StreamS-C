"use client";

import { useEffect } from "react";
import { LOCK_EVENT, isLocked } from "@/lib/rotateLock";

const PAUSE_AFTER_KEY_MS = 2 * 60 * 1000;
const LAST_KEY = "rotate.last";

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
 * While locked (Up on the remote), neither happens.
 */
export function useRotate(seconds: number, skip = false) {
  useEffect(() => {
    if (!skip || isLocked()) return;
    try {
      sessionStorage.setItem(LAST_KEY, String(Date.now()));
    } catch {}
    goNext().catch(() => {});
  }, [skip]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("rotate") === "0") return;
    const periodMs = seconds * 1000;
    let timer: ReturnType<typeof setTimeout>;
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
      if (isLocked()) return arm(periodMs);
      const since = Date.now() - lastAdvance();
      if (!retry && since >= 0 && since < periodMs * 0.9)
        return arm(periodMs - since);
      done = true;
      try {
        sessionStorage.setItem(LAST_KEY, String(Date.now()));
      } catch {}
      try {
        await goNext();
        // Still here 15 s after navigating (slow or failed load): try again.
        setTimeout(() => {
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
        arm(periodMs);
      }
    };
    arm(periodMs);
    window.addEventListener("keydown", onKey);
    window.addEventListener(LOCK_EVENT, onLock);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(LOCK_EVENT, onLock);
    };
  }, [seconds]);
}

async function goNext() {
  // Give up after 8 s so a hung request can't freeze rotation.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  let screens: { path: string }[];
  try {
    ({ screens } = (await (
      await fetch("/screens.json", { cache: "no-store", signal: ctrl.signal })
    ).json()) as {
      screens: { path: string }[];
    });
  } finally {
    clearTimeout(t);
  }
  const i = screens.findIndex((s) => s.path === location.pathname);
  const next = i >= 0 ? screens[(i + 1) % screens.length] : screens[0];
  location.href = next.path;
}
