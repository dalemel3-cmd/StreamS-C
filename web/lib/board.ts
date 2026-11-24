// Shared types and helpers for the HPD office board screens.

export type Best = {
  name: string; // first name + last initial only (minors, public office)
  sport: string | null; // display label; "A · B" when one athlete has profiles in two sports
  sports?: string[]; // every sport the athlete is on (filtering uses this)
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

/** One athlete's change this semester on one metric (first 2 weeks vs last 30 days of logging). */
export type Improver = Pick<
  Best,
  "name" | "sport" | "sports" | "metric" | "unit" | "higher"
> & {
  start: number;
  now: number;
  days: number;
};

export type Board = {
  generated_at: string;
  bests: Best[];
  trends: Trend[];
  gains?: Gain[];
  improvers?: Improver[];
  semester?: string;
  semester_bests?: Pick<
    Best,
    | "name"
    | "sport"
    | "sports"
    | "metric"
    | "unit"
    | "higher"
    | "value"
    | "date"
  >[];
  stale?: boolean;
};

/** URL slug -> metric name as stored by the HPD data feed. */
export const METRICS: Record<
  string,
  { metric: string; title: string; note: string }
> = {
  bench: {
    metric: "Bench",
    title: "Bench Press",
    note: "",
  },
  squat: {
    metric: "Squat",
    title: "Back Squat",
    note: "",
  },
  "front-squat": {
    metric: "Front Squat",
    title: "Front Squat",
    note: "",
  },
  "hang-clean": {
    metric: "Hang Clean",
    title: "Hang Clean",
    note: "",
  },
  "power-clean": {
    metric: "Power Clean",
    title: "Power Clean",
    note: "",
  },
  deadlift: {
    metric: "Deadlift",
    title: "Deadlift",
    note: "",
  },
  vertical: { metric: "Vertical", title: "Vertical Jump", note: "Arm swing" },
  "vertical-no-arms": {
    metric: "Vertical (no arms)",
    title: "Vertical Jump",
    note: "Hands on hips",
  },
  "fly-10": { metric: "Fly 10", title: "Fly 10", note: "Fastest time" },
};

/** The HPD app shows estimated maxes to the nearest 5 lb (v5.16.5); ranking stays on the exact value. */
export const round5 = (v: number) => Math.round(v / 5) * 5;

export function formatValue(v: number, unit: Best["unit"]): string {
  if (unit === "s") return v.toFixed(2);
  if (unit === "in") return v.toFixed(1);
  return String(round5(v));
}

export const UNIT_LABEL: Record<Best["unit"], string> = {
  lb: "LB",
  in: "IN",
  s: "SEC",
};

/** Every sport an athlete's mark belongs to (falls back to `sport` for older feeds). */
export function sportsOf(b: Pick<Best, "sport" | "sports">): string[] {
  return b.sports ?? (b.sport ? [b.sport] : []);
}

/** True when no sport is picked or the athlete is on the picked sport. */
export function inSport(
  b: Pick<Best, "sport" | "sports">,
  sport: string | null,
): boolean {
  return !sport || sportsOf(b).includes(sport);
}

/** Ranked bests for one metric, optionally filtered by sport. */
export function ranked(
  board: Board | null,
  metric: string,
  sport: string | null,
): Best[] {
  if (!board) return [];
  return board.bests
    .filter((b) => b.metric === metric && inSport(b, sport))
    .sort((a, b) => (a.higher ? b.value - a.value : a.value - b.value));
}

export function sportsIn(board: Board | null): string[] {
  if (!board) return [];
  return [...new Set(board.bests.flatMap(sportsOf))].sort();
}
