"use client";

import Frame from "@/components/board/Frame";
import styles from "@/components/board/board.module.css";
import { useBoard } from "@/components/board/useBoard";
import { useRotate } from "@/components/board/useRotate";
import { METRICS, UNIT_LABEL, formatValue, ranked } from "@/lib/board";

const SHOW = ["bench", "squat", "front-squat", "hang-clean", "power-clean", "vertical", "vertical-no-arms", "fly-10"];
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default function Records() {
  const { board, offline } = useBoard();
  useRotate(25);

  const records = SHOW.map((slug) => ({ def: METRICS[slug], top: ranked(board, METRICS[slug].metric, null)[0] })).filter(
    (r) => r.top,
  );

  return (
    <Frame eyebrow="Shiloh HPD · All-time" title="School records" updated={board?.generated_at} offline={offline}>
      {records.length === 0 ? (
        <div className={styles.empty}>Loading…</div>
      ) : (
        <div className={styles.cards} style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {records.map(({ def, top }) => (
            <div key={def.metric} className={styles.card}>
              <span className={styles.cardLabel}>
                {def.metric === "Vertical (no arms)" ? "Vertical · No arms" : def.title}
              </span>
              <span>
                <span className={styles.cardValue}>{formatValue(top.value, top.unit)}</span>
                <span className={styles.unit}>{UNIT_LABEL[top.unit]}</span>
              </span>
              <span className={styles.who}>
                <span className={styles.name} style={{ fontSize: 44 }}>{top.name}</span>
                <span className={styles.meta}>
                  {top.sport} · {dateFmt.format(new Date(top.date))}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}
