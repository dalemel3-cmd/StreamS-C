"use client";

import { useEffect, useState } from "react";
import { store } from "@/lib/tv";
import type { Board } from "@/lib/board";

const KEY = "board.data";
const REFRESH_MS = 5 * 60 * 1000;

// Module-level shared cache so client-side screen rotations don't refetch /api/board every 20 s.
let memBoard: Board | null = null;
let memOffline = false;
let lastFetchedAt = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

function hydrateFromStorage() {
  if (memBoard) return;
  const cached = store.get<Board>(KEY);
  if (cached) memBoard = cached;
}

async function fetchBoard(force = false) {
  if (!force && lastFetchedAt && Date.now() - lastFetchedAt < REFRESH_MS) return;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch("/api/board", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data: Board = await res.json();
      memBoard = data;
      memOffline = Boolean(data.stale);
      lastFetchedAt = Date.now();
      store.set(KEY, data);
    } catch {
      memOffline = true;
    } finally {
      inFlight = null;
      notify();
    }
  })();
  return inFlight;
}

/** Board data: cached copy first, shared across screen rotations, refreshed every 5 minutes. Never blanks on failure. */
export function useBoard() {
  const [board, setBoard] = useState<Board | null>(() => memBoard);
  const [offline, setOffline] = useState(() => memOffline);

  useEffect(() => {
    hydrateFromStorage();
    const sync = () => {
      setBoard(memBoard);
      setOffline(memOffline);
    };
    listeners.add(sync);
    sync();

    void fetchBoard(false);
    const id = setInterval(() => void fetchBoard(true), REFRESH_MS);
    return () => {
      listeners.delete(sync);
      clearInterval(id);
    };
  }, []);

  return { board, offline };
}
