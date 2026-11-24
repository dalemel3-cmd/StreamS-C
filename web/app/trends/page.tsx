"use client";

import Frame from "@/components/board/Frame";
import styles from "@/components/board/board.module.css";
import { useBoard } from "@/components/board/useBoard";
import { useRotate } from "@/components/board/useRotate";
import { useSportFilter } from "@/components/board/useSportFilter";
import { formatValue, sportsIn } from "@/lib/board";

// Columns under a group header (gold underline on every group): Bench | Squat (Back, Front) | Clean (Hang, Power) | Vertical (Arm swing, Hands on hips).
const GROUPS = [
  {
    label: "Bench",
    cols: [{ metric: "Bench", label: "", unit: "lb" as const }],
  },
  {
    label: "Squat",
    cols: [
      { metric: "Squat", label: "Back", unit: "lb" as const },
      { metric: "Front Squat", label: "Front", unit: "lb" as const },
    ],
  },
  {
    label: "Clean",
    cols: [
      { metric: "Hang Clean", label: "Hang", unit: "lb" as const },
      { metric: "Power Clean", label: "Power", unit: "lb" as const },
    ],
  },
  {
    label: "Vertical",
    cols: [
      { metric: "Vertical", label: "Arm swing", unit: "in" as const },
      {
        metric: "Vertical (no arms)",
        label: "Hands on hips",
        unit: "in" as const,
      },
    ],
  },
];
const COLS: { metric: string; label: string }[] = GROUPS.flatMap((g) =>
  g.cols.map((c) => ({ metric: c.metric, label: c.label })),
);
const MIN_ATHLETES = 3;

export default function Trends() {
  const { board, offline } = useBoard();
  const sport = useSportFilter(sportsIn(board));
  const gains = (board?.gains ?? []).filter((g) => g.athletes >= MIN_ATHLETES);
  const cell = (team: string, metric: string) =>
    gains.find((g) => g.sport === team && g.metric === metric) ?? null;
  const sports = [
    ...new Set(gains.map((g) => g.sport).filter((s) => !sport || s === sport)),
  ]
    .map((team) => ({
      sport: team,
      cells: COLS.map((c) => cell(team, c.metric)),
    }))
    .filter((r) => r.cells.some(Boolean))
    // Fullest rows first so teams with data in more columns make the cut.
    .sort(
      (a, b) =>
        b.cells.filter(Boolean).length - a.cells.filter(Boolean).length ||
        a.sport.localeCompare(b.sport),
    )
    .slice(0, 5);
  useRotate(25, Boolean(board && sport && sports.length === 0));

  return (
    <Frame
      eyebrow={`Shiloh HPD · ${sport ?? "All sports"} · Team average max`}
      title="Season trends"
      note={
        board?.semester ? `${board.semester} · start → now` : "This semester"
      }
      filter="OK: change sport"
      updated={board?.generated_at}
      offline={offline}
    >
      {sports.length === 0 ? (
        <div className={styles.empty}>
          {board ? "Not enough data yet" : "Loading…"}
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th rowSpan={2}>Team</th>
              {GROUPS.map((g) => (
                <th
                  key={g.label}
                  colSpan={g.cols.length}
                  className={styles.group}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {GROUPS.flatMap((g) =>
                g.cols.map((c) => (
                  <th key={c.metric} className={styles.sub}>
                    {c.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {sports.map(({ sport, cells }) => (
              <tr key={sport}>
                <td>{sport}</td>
                {cells.map((g, i) => {
                  if (!g)
                    return (
                      <td key={i} className={styles.dim}>
                        —
                      </td>
                    );
                  // Weights round to the nearest 5 lb; the change is the difference of the two shown numbers.
                  const shown = (v: number) =>
                    g.unit === "lb" ? Math.round(v / 5) * 5 : v;
                  const now = shown(g.recent_avg);
                  const start = shown(g.base_avg);
                  const change =
                    g.unit === "lb"
                      ? now - start
                      : g.higher
                        ? g.improvement
                        : -g.improvement;
                  const flat =
                    Math.abs(change) < (g.unit === "lb" ? 0.5 : 0.05);
                  const better = g.higher ? change > 0 : change < 0;
                  const cls = flat
                    ? styles.dim
                    : better
                      ? styles.upBig
                      : styles.downBig;
                  return (
                    <td key={i}>
                      <span className={styles.big}>
                        {formatValue(now, g.unit)}
                      </span>
                      <span className={`${styles.delta} ${cls}`}>
                        {flat
                          ? "±0"
                          : `${change > 0 ? "+" : "−"}${formatValue(Math.abs(change), g.unit)}`}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Frame>
  );
}
