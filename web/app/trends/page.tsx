"use client";

import Frame from "@/components/board/Frame";
import styles from "@/components/board/board.module.css";
import { useBoard } from "@/components/board/useBoard";
import { useRotate } from "@/components/board/useRotate";
import { useSportFilter } from "@/components/board/useSportFilter";
import { formatValue, sportsIn, type Trend } from "@/lib/board";

// Paired columns under a group header: Bench | Squat (Back, Front) | Clean (Hang, Power) | Vertical (Arm swing, Hands on hips).
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
const COLS = GROUPS.flatMap((g) => g.cols.map((c) => ({ ...c, higher: true })));
const MIN_ATHLETES = 3;

/** First vs latest month team average for one sport + metric, when both months have enough athletes. */
function change(trends: Trend[], sport: string, metric: string) {
  const rows = trends
    .filter(
      (t) =>
        t.sport === sport && t.metric === metric && t.athletes >= MIN_ATHLETES,
    )
    .sort((a, b) => a.month.localeCompare(b.month));
  if (rows.length === 0) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  return {
    latest: last.avg,
    delta: rows.length > 1 ? last.avg - first.avg : null,
  };
}

export default function Trends() {
  const { board, offline } = useBoard();
  const sport = useSportFilter(sportsIn(board));
  const trends = board?.trends ?? [];
  const sports = [
    ...new Set(
      trends
        .map((t) => t.sport)
        .filter((s): s is string => Boolean(s) && (!sport || s === sport)),
    ),
  ]
    .map((sport) => ({
      sport,
      cells: COLS.map((c) => change(trends, sport, c.metric)),
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
      eyebrow={`Shiloh HPD · ${sport ?? "All sports"} · Team averages`}
      title="Season trends"
      note="Since first test month"
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
                  rowSpan={g.cols.length === 1 ? 2 : 1}
                  className={
                    g.cols.length === 1
                      ? `${styles.group} ${styles.solo}`
                      : styles.group
                  }
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {GROUPS.filter((g) => g.cols.length > 1).flatMap((g) =>
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
                {cells.map((cell, i) => {
                  const col = COLS[i];
                  if (!cell)
                    return (
                      <td key={i} className={styles.dim}>
                        —
                      </td>
                    );
                  const better =
                    cell.delta != null &&
                    (col.higher ? cell.delta > 0 : cell.delta < 0);
                  return (
                    <td key={i}>
                      <span className={styles.big}>
                        {formatValue(cell.latest, col.unit)}
                      </span>
                      {cell.delta != null && Math.abs(cell.delta) >= 0.05 && (
                        <span
                          className={`${styles.delta} ${better ? styles.up : styles.down}`}
                        >
                          {cell.delta > 0 ? "▲" : "▼"}{" "}
                          {formatValue(Math.abs(cell.delta), col.unit)}
                        </span>
                      )}
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
