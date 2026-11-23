"use client";

import { useEffect } from "react";

const CHECK_MS = 60 * 1000;

/** Reloads the page when a new deployment goes live, so the TV never needs a manual relaunch. */
export default function AutoReload() {
  useEffect(() => {
    let current: string | null = null;
    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { id } = (await res.json()) as { id: string };
        if (current === null) current = id;
        else if (id !== current) location.reload();
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
