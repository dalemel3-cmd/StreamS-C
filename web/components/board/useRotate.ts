"use client";

import { useEffect } from "react";

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
 */
export function useRotate(seconds: number) {
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

    const next = async () => {
      if (done) return;
      const since = Date.now() - lastAdvance();
      if (since < periodMs * 0.9) return arm(periodMs - since);
      done = true;
      try {
        sessionStorage.setItem(LAST_KEY, String(Date.now()));
      } catch {}
      try {
        const { screens } = (await (await fetch("/screens.json", { cache: "no-store" })).json()) as {
          screens: { path: string }[];
        };
        const i = screens.findIndex((s) => s.path === location.pathname);
        const next = i >= 0 ? screens[(i + 1) % screens.length] : screens[0];
        location.href = next.path;
      } catch {
        done = false;
      }
    };
    const arm = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(next, ms);
    };
    const onKey = () => arm(PAUSE_AFTER_KEY_MS);
    arm(periodMs);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [seconds]);
}
