"use client";

import { useEffect, useState } from "react";
import { onOk } from "@/lib/tv";
import {
  SPORT_EVENT,
  clearLegacySport,
  readSport,
  writeSport,
} from "@/lib/sportFilter";

/** OK on the remote cycles All -> each sport -> All. `?sport=Football` pins it. Shared across screens and the Down menu until relaunch. */
export function useSportFilter(sports: string[]) {
  const [sport, setSport] = useState<string | null>(null);

  useEffect(() => {
    clearLegacySport();
    const pinned = new URLSearchParams(location.search).get("sport");
    setSport(pinned ?? readSport());

    const onChange = (e: Event) => {
      if (new URLSearchParams(location.search).get("sport")) return;
      const next = (e as CustomEvent<string | null>).detail ?? readSport();
      setSport(next);
    };
    window.addEventListener(SPORT_EVENT, onChange);
    return () => window.removeEventListener(SPORT_EVENT, onChange);
  }, []);

  useEffect(
    () =>
      onOk(() =>
        setSport((cur) => {
          const order = [null, ...sports];
          const next = order[(order.indexOf(cur) + 1) % order.length] ?? null;
          writeSport(next);
          return next;
        }),
      ),
    [sports],
  );

  // A saved sport that no longer has data falls back to All.
  return sport && sports.length && !sports.includes(sport) ? null : sport;
}
