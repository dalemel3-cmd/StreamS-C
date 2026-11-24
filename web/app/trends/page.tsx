"use client";

import Frame from "@/components/board/Frame";
import styles from "@/components/board/board.module.css";
import { useBoard } from "@/components/board/useBoard";
import { useRotate } from "@/components/board/useRotate";
import { formatValue, type Trend } from "@/lib/board";

const COLS = [
  { metric: "Bench", label: "Bench", unit: "lb" as const, higher: true },
  { metric: "Squat", label: "Squat", unit: "lb" as const, higher: true },
  { metric: "Hang Clean", label: "Hang Clean", unit: "lb" as const, higher: true },
  { metric: "Vertical", label: "Vertical", unit: "in" as const, higher: true },
];
const MIN_ATHLETES = 3;

/** First vs latest month team average for one sport + metric, when both months have enough athletes. */
function change(trends: Trend[], sport: string, metric: string) {
  const rows = trends
    .filter((t) => t.sport === sport && t.metric === metric && t.athletes >= MIN_ATHLETES)
    .sort((a, b) => a.month.localeCompare(b.month));
  if (rows.length === 0) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  return { latest: last.avg, delta: rows.length > 1 ? last.avg - first.avg : null };
}

export default function Trends() {
  const { board, offline } = useBoard();
  useRotate(25);
  const trends = board?.trends ?? [];
  const sports = [...new Set(trends.map((t) => t.sport).filter((s): s is string => Boolean(s)))]
    .map((sport) => ({ sport, cells: COLS.map((c) => change(trends, sport, c.metric)) }))
    .filter((r) => r.cells.some(Boolean))
    .slice(0, 5);

  return (
    <Frame
      eyebrow="Shiloh HPD · Team averages"
      title="Season trends"
      note="Since first test month"
      updated={board?.generated_at}
      offline={offline}
    >
      {sports.length === 0 ? (
        <div className={styles.empty}>{board ? "Not enough data yet" : "Loading…"}</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Team</th>
              {COLS.map((c) => (
                <th key={c.metric}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sports.map(({ sport, cells }) => (
              <tr key={sport}>
                <td>{sport}</td>
                {cells.map((cell, i) => {
                  const col = COLS[i];
                  if (!cell) return <td key={i} className={styles.dim}>—</td>;
                  const better = cell.delta != null && (col.higher ? cell.delta > 0 : cell.delta < 0);
                  return (
                    <td key={i}>
                      <span className={styles.big}>{formatValue(cell.latest, col.unit)}</span>
                      {cell.delta != null && Math.abs(cell.delta) >= 0.05 && (
                        <span className={better ? styles.up : styles.down}>
                          {cell.delta > 0 ? "▲" : "▼"} {formatValue(Math.abs(cell.delta), col.unit)}
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
