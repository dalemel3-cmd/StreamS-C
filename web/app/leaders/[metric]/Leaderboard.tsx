"use client";

import Frame from "@/components/board/Frame";
import styles from "@/components/board/board.module.css";
import { useBoard } from "@/components/board/useBoard";
import { useRotate } from "@/components/board/useRotate";
import { useSportFilter } from "@/components/board/useSportFilter";
import { METRICS, UNIT_LABEL, formatValue, ranked, sportsIn } from "@/lib/board";

export default function Leaderboard({ slug }: { slug: string }) {
  const def = METRICS[slug];
  const { board, offline } = useBoard();
  const sport = useSportFilter(sportsIn(board));
  useRotate(20);
  // A sport with no marks for this test (e.g. Football has only no-arms verticals) shows All sports instead.
  const forSport = ranked(board, def.metric, sport);
  const fallback = Boolean(sport) && forSport.length === 0;
  const top = (fallback ? ranked(board, def.metric, null) : forSport).slice(0, 10);
  const scope = !sport ? "All sports" : fallback ? `All sports · no ${sport} marks` : sport;

  return (
    <Frame
      eyebrow={`Shiloh HPD · ${scope}`}
      title={def.title}
      note={def.note}
      filter="OK: change sport"
      updated={board?.generated_at}
      offline={offline}
    >
      {top.length === 0 ? (
        <div className={styles.empty}>{board ? "No marks yet" : "Loading…"}</div>
      ) : (
        <div className={styles.leaders}>
          {top.map((b, i) => (
            <div key={`${b.name}-${i}`} className={`${styles.row} ${i < 3 ? styles.top : ""}`}>
              <span className={styles.rank}>{i + 1}</span>
              <span className={styles.who}>
                <span className={styles.name}>{b.name}</span>
                <span className={styles.meta}>{[b.sport, b.position, b.grade].filter(Boolean).join(" · ")}</span>
              </span>
              <span className={styles.value}>
                {formatValue(b.value, b.unit)}
                <span className={styles.unit}>{UNIT_LABEL[b.unit]}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}
