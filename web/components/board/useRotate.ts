"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LOCK_EVENT, isLocked } from "@/lib/rotateLock";
import { fadeIn, fadeOut } from "@/lib/transition";

type Router = ReturnType<typeof useRouter>;

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
 *
 * Screens switch in-app with a short fade (no full page reload), and the next screen
 * is prefetched while this one is showing.
 */
export function useRotate(seconds: number, skip = false) {
  const router = useRouter();

  // This screen just mounted: fade it in and warm up the next one.
  useEffect(() => {
    fadeIn();
    nextPath()
      .then((p) => router.prefetch(p))
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
    const periodMs = seconds * 1000;
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
      if (isLocked()) return arm(periodMs);
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
        arm(periodMs);
      }
    };
    arm(periodMs);
    window.addEventListener("keydown", onKey);
    window.addEventListener(LOCK_EVENT, onLock);
    return () => {
      clearTimeout(timer);
      clearTimeout(retryTimer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(LOCK_EVENT, onLock);
    };
  }, [seconds, router]);
}

/** Path of the screen after this one in screens.json (the first screen if this one isn't listed). */
async function nextPath(): Promise<string> {
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
  return (i >= 0 ? screens[(i + 1) % screens.length] : screens[0]).path;
}

async function goNext(router: Router) {
  const path = await nextPath();
  await fadeOut();
  router.push(path);
  // If the switch stalls, don't leave the screen dark.
  setTimeout(fadeIn, 4000);
}
