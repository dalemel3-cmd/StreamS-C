// Shared types and helpers for the HPD office board screens.

export type Best = {
  name: string; // first name + last initial only (minors, public office)
  sport: string | null;
  grade: string | null;
  position: string | null;
  metric: string;
  unit: "lb" | "in" | "s";
  higher: boolean; // true: bigger is better; false: lower is better (sprint times)
  value: number;
  date: string; // YYYY-MM-DD
  pr_this_week: boolean;
  previous: number | null; // best before the last 7 days
};

export type Trend = {
  metric: string;
  sport: string | null;
  month: string;
  athletes: number;
  avg: number;
};

/** This semester, same athletes: avg max in their first 2 weeks (base) vs avg max over their last 30 days of logging (recent). */
export type Gain = {
  metric: string;
  sport: string;
  unit: "lb" | "in" | "s";
  higher: boolean;
  athletes: number;
  base_avg: number;
  recent_avg: number;
  improvement: number; // > 0 means better (faster for sprint times), in the metric's units
  improvement_pct: number; // percent, > 0 means better
};

export type Board = {
  generated_at: string;
  bests: Best[];
  trends: Trend[];
  gains?: Gain[];
  semester?: string;
  semester_bests?: Pick<
    Best,
    "name" | "sport" | "metric" | "unit" | "higher" | "value" | "date"
  >[];
  stale?: boolean;
};

/** URL slug -> metric name as stored by the HPD data feed. */
export const METRICS: Record<
  string,
  { metric: string; title: string; note: string }
> = {
  bench: { metric: "Bench", title: "Bench Press", note: "Estimated 1RM" },
  squat: { metric: "Squat", title: "Back Squat", note: "Estimated 1RM" },
  "front-squat": {
    metric: "Front Squat",
    title: "Front Squat",
    note: "Estimated 1RM",
  },
  "hang-clean": {
    metric: "Hang Clean",
    title: "Hang Clean",
    note: "Estimated 1RM",
  },
  "power-clean": {
    metric: "Power Clean",
    title: "Power Clean",
    note: "Estimated 1RM",
  },
  deadlift: { metric: "Deadlift", title: "Deadlift", note: "Estimated 1RM" },
  vertical: { metric: "Vertical", title: "Vertical Jump", note: "Arm swing" },
  "vertical-no-arms": {
    metric: "Vertical (no arms)",
    title: "Vertical Jump",
    note: "Hands on hips",
  },
  "fly-10": { metric: "Fly 10", title: "Fly 10", note: "Fastest time" },
};

export function formatValue(v: number, unit: Best["unit"]): string {
  if (unit === "s") return v.toFixed(2);
  if (unit === "in") return v.toFixed(1);
  return String(Math.round(v));
}

export const UNIT_LABEL: Record<Best["unit"], string> = {
  lb: "LB",
  in: "IN",
  s: "SEC",
};

/** Ranked bests for one metric, optionally filtered by sport. */
export function ranked(
  board: Board | null,
  metric: string,
  sport: string | null,
): Best[] {
  if (!board) return [];
  return board.bests
    .filter((b) => b.metric === metric && (!sport || b.sport === sport))
    .sort((a, b) => (a.higher ? b.value - a.value : a.value - b.value));
}

export function sportsIn(board: Board | null): string[] {
  if (!board) return [];
  return [
    ...new Set(
      board.bests.map((b) => b.sport).filter((s): s is string => Boolean(s)),
    ),
  ].sort();
}
