"use client";

import { useEffect, useState } from "react";
import { store } from "@/lib/tv";
import type { Board } from "@/lib/board";

const KEY = "board.data";
const REFRESH_MS = 5 * 60 * 1000;

/** Board data: cached copy first, then refresh every 5 minutes. Never blanks on failure. */
export function useBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const cached = store.get<Board>(KEY);
    if (cached) setBoard(cached);
    const load = async () => {
      try {
        const res = await fetch("/api/board", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data: Board = await res.json();
        setBoard(data);
        setOffline(Boolean(data.stale));
        store.set(KEY, data);
      } catch {
        setOffline(true);
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  return { board, offline };
}
