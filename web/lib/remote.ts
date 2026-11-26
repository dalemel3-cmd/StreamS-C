// Web remote (/remote) shared types. The remote page queues commands through /api/remote/send;
// the TV page (components/RemoteListener.tsx) picks them up from /api/remote/poll.

import type { Mode } from "@/lib/screenSettings";

export type RemoteCommand =
  | { type: "go"; path: string }
  | { type: "step"; delta: 1 | -1 }
  | { type: "ok" }
  | { type: "lock"; on: boolean }
  | { type: "sport"; value: string | null }
  | { type: "seconds"; value: number | null }
  | { type: "mode"; path: string; mode: Mode }
  | { type: "reload" };

export type TvStatus = {
  path: string;
  locked: boolean;
  sport: string | null;
  sports: string[];
  seconds: number | null;
  settings: Record<string, Mode>;
  device: string;
  build: string;
};

export type PollResponse = {
  last: number;
  commands: { id: number; cmd: RemoteCommand }[];
  fast: boolean;
};

export type StatusResponse = {
  tv: TvStatus | null;
  tv_seen_at: string | null;
  now: string;
};

const MODES = new Set(["on", "off", "only"]);
const isPath = (p: unknown): p is string =>
  typeof p === "string" && /^\/[a-z0-9\-/]{0,80}$/i.test(p);

/** Server-side check of what the remote page sends. Returns a clean command or null. */
export function parseCommand(raw: unknown): RemoteCommand | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  switch (c.type) {
    case "go":
      return isPath(c.path) ? { type: "go", path: c.path } : null;
    case "step":
      return c.delta === 1 || c.delta === -1 ? { type: "step", delta: c.delta } : null;
    case "ok":
      return { type: "ok" };
    case "reload":
      return { type: "reload" };
    case "lock":
      return typeof c.on === "boolean" ? { type: "lock", on: c.on } : null;
    case "sport":
      if (c.value === null) return { type: "sport", value: null };
      return typeof c.value === "string" && c.value.length <= 60
        ? { type: "sport", value: c.value }
        : null;
    case "seconds":
      if (c.value === null) return { type: "seconds", value: null };
      return typeof c.value === "number" && c.value >= 5 && c.value <= 600
        ? { type: "seconds", value: c.value }
        : null;
    case "mode":
      return isPath(c.path) && typeof c.mode === "string" && MODES.has(c.mode)
        ? { type: "mode", path: c.path, mode: c.mode as Mode }
        : null;
    default:
      return null;
  }
}
