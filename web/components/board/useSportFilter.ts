"use client";

import { useEffect, useState } from "react";
import { onOk } from "@/lib/tv";

const KEY = "board.sport";

// Per app run only (sessionStorage), so every launch starts on All sports.
const session = {
  get(): string | null {
    try {
      return sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(v: string | null) {
    try {
      if (v) sessionStorage.setItem(KEY, v);
      else sessionStorage.removeItem(KEY);
    } catch {}
  },
};

/** OK on the remote cycles All -> each sport -> All. `?sport=Football` pins it. Shared across screens until relaunch. */
export function useSportFilter(sports: string[]) {
  const [sport, setSport] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.removeItem(KEY); // older builds saved it permanently
    } catch {}
    setSport(new URLSearchParams(location.search).get("sport") ?? session.get());
  }, []);

  useEffect(
    () =>
      onOk(() =>
        setSport((cur) => {
          const order = [null, ...sports];
          const next = order[(order.indexOf(cur) + 1) % order.length] ?? null;
          session.set(next);
          return next;
        }),
      ),
    [sports],
  );

  // A saved sport that no longer has data falls back to All.
  return sport && sports.length && !sports.includes(sport) ? null : sport;
}
