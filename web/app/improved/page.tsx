"use client";

import Frame from "@/components/board/Frame";
import styles from "@/components/board/board.module.css";
import { useBoard } from "@/components/board/useBoard";
import { useRotate } from "@/components/board/useRotate";
import { useSportFilter } from "@/components/board/useSportFilter";
import {
  type Improver,
  METRICS,
  UNIT_LABEL,
  formatValue,
  inSport,
  round5,
  sportsIn,
} from "@/lib/board";

// Barbell lifts only, so pounds compare across rows.
const LIFTS = ["Bench", "Squat", "Front Squat", "Hang Clean", "Power Clean"];
const TITLE: Record<string, string> = Object.fromEntries(
  Object.values(METRICS).map((m) => [m.metric, m.title]),
);

/** Biggest gains this semester: each athlete once, on the lift they gained the most pounds. */
export default function MostImproved() {
  const { board, offline } = useBoard();
  const sport = useSportFilter(sportsIn(board));
  const best = new Map<string, Improver & { gain: number }>();
  for (const r of board?.improvers ?? []) {
    if (!LIFTS.includes(r.metric) || !inSport(r, sport)) continue;
    // Change between the numbers as shown (nearest 5 lb), like the app.
    const gain = round5(r.now) - round5(r.start);
    if (gain <= 0) continue;
    const key = `${r.name}|${r.sport}`;
    const cur = best.get(key);
    if (!cur || gain > cur.gain) best.set(key, { ...r, gain });
  }
  const rows = [...best.values()].sort((a, b) => b.gain - a.gain).slice(0, 8);
  useRotate(25, Boolean(board && sport && rows.length === 0));

  return (
    <Frame
      eyebrow={`Shiloh HPD · ${sport ?? "All sports"} · ${board?.semester ?? "This semester"}`}
      title="Most improved"
      filter="OK: change sport"
      updated={board?.generated_at}
      offline={offline}
    >
      {rows.length === 0 ? (
        <div className={styles.empty}>
          {board ? "Not enough data yet" : "Loading…"}
        </div>
      ) : (
        <table className={`${styles.table} ${styles.tight}`}>
          <thead>
            <tr>
              <th>Athlete</th>
              <th>Lift</th>
              <th>Now</th>
              <th>Gain</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  {r.name}
                  {!sport && r.sport && (
                    <span className={styles.meta}> &nbsp;{r.sport}</span>
                  )}
                </td>
                <td>{TITLE[r.metric] ?? r.metric}</td>
                <td>
                  <span className={styles.big}>
                    {formatValue(r.now, r.unit)}
                  </span>
                  <span className={styles.unit}>{UNIT_LABEL[r.unit]}</span>
                </td>
                <td className={styles.upBig}>+{formatValue(r.gain, r.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Frame>
  );
}
