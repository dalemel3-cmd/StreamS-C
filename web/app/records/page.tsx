"use client";

import Frame from "@/components/board/Frame";
import styles from "@/components/board/board.module.css";
import { useBoard } from "@/components/board/useBoard";
import { useRotate } from "@/components/board/useRotate";
import { useSportFilter } from "@/components/board/useSportFilter";
import {
  METRICS,
  UNIT_LABEL,
  formatValue,
  inSport,
  sportsIn,
} from "@/lib/board";

const SHOW = [
  "bench",
  "squat",
  "front-squat",
  "hang-clean",
  "power-clean",
  "vertical",
  "vertical-no-arms",
  "fly-10",
  "top-speed",
];
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export default function Records() {
  const { board, offline } = useBoard();
  const sport = useSportFilter(sportsIn(board));
  const records = SHOW.map((slug) => ({
    def: METRICS[slug],
    // This semester's best for the metric (falls back to all marks if the feed predates semester_bests).
    top: (board?.semester_bests ?? board?.bests ?? [])
      .filter((b) => b.metric === METRICS[slug].metric && inSport(b, sport))
      .sort((a, b) => (a.higher ? b.value - a.value : a.value - b.value))[0],
  })).filter((r) => r.top);
  useRotate(25, Boolean(board && sport && records.length === 0));

  return (
    <Frame
      eyebrow={`Shiloh HPD · ${sport ?? "All sports"} · ${board?.semester ?? "This semester"}`}
      title="Semester records"
      filter="OK: change sport"
      updated={board?.generated_at}
      offline={offline}
    >
      {records.length === 0 ? (
        <div className={styles.empty}>
          {board ? "No marks yet" : "Loading…"}
        </div>
      ) : (
        <div
          className={styles.cards}
          style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
        >
          {records.map(({ def, top }) => (
            <div key={def.metric} className={styles.card}>
              <span className={styles.cardLabel}>
                {def.metric === "Vertical (no arms)"
                  ? "Vertical · No arms"
                  : def.title}
              </span>
              <span>
                <span className={styles.cardValue}>
                  {formatValue(top.value, top.unit)}
                </span>
                <span className={styles.unit}>{UNIT_LABEL[top.unit]}</span>
              </span>
              <span className={styles.who}>
                <span className={styles.name} style={{ fontSize: 44 }}>
                  {top.name}
                </span>
                <span className={styles.meta}>
                  {[!sport && top.sport, dateFmt.format(new Date(top.date))]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}
