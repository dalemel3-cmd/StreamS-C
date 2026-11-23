"use client";

import { useEffect, useState } from "react";
import { onOk, store } from "@/lib/tv";

const KEY = "board.sport";

/** OK on the remote cycles All -> each sport -> All. `?sport=Football` pins it. Shared across screens. */
export function useSportFilter(sports: string[]) {
  const [sport, setSport] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("sport");
    setSport(q ?? store.get<string>(KEY));
  }, []);

  useEffect(
    () =>
      onOk(() =>
        setSport((cur) => {
          const order = [null, ...sports];
          const next = order[(order.indexOf(cur) + 1) % order.length] ?? null;
          store.set(KEY, next);
          return next;
        }),
      ),
    [sports],
  );

  // A saved sport that no longer has data falls back to All.
  return sport && sports.length && !sports.includes(sport) ? null : sport;
}
