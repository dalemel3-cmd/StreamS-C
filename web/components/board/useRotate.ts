"use client";

import { useEffect } from "react";

const PAUSE_AFTER_KEY_MS = 2 * 60 * 1000;

/**
 * Auto-rotate to the next screen after `seconds`. On the stick the shell moves on
 * (so its D-pad position stays in sync); in a browser we follow screens.json.
 * Any key press pauses rotation for two minutes. `?rotate=0` turns it off.
 */
export function useRotate(seconds: number) {
  useEffect(() => {
    if (new URLSearchParams(location.search).get("rotate") === "0") return;
    let timer: ReturnType<typeof setTimeout>;
    const next = async () => {
      if (window.MasonTV) return window.MasonTV.nextScreen();
      try {
        const { screens } = (await (await fetch("/screens.json", { cache: "no-store" })).json()) as {
          screens: { path: string }[];
        };
        const here = location.pathname;
        const i = screens.findIndex((s) => s.path === here);
        location.href = screens[(i + 1) % screens.length].path;
      } catch {}
    };
    const arm = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(next, ms);
    };
    const onKey = () => arm(PAUSE_AFTER_KEY_MS);
    arm(seconds * 1000);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [seconds]);
}
