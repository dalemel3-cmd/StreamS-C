"use client";

import { useEffect } from "react";

const CHECK_MS = 60 * 1000;
const KEY = "reload.last";
// The build this page's code came from (see next.config.ts).
const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

/**
 * Reloads the page when the live deployment differs from the code running here, so the
 * TV never needs a manual relaunch. Compares against the id baked into this bundle, so a
 * page that missed a deploy (offline, asleep) still catches up on the next check.
 */
export default function AutoReload() {
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { id } = (await res.json()) as { id: string };
        if (!id || id === "dev" || BUILD === "dev" || id === BUILD) return;
        // At most one reload per 5 min, so a mismatch can never loop.
        const last = Number(sessionStorage.getItem(KEY)) || 0;
        if (Date.now() - last < 5 * 60 * 1000) return;
        sessionStorage.setItem(KEY, String(Date.now()));
        location.reload();
      } catch {
        // Offline: keep showing what we have.
      }
    };
    check();
    const timer = setInterval(check, CHECK_MS);
    return () => clearInterval(timer);
  }, []);
  return null;
}
