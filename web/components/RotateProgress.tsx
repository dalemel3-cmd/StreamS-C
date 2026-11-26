"use client";

import { useEffect, useState } from "react";
import { ROTATE_PROGRESS_EVENT, type RotateProgressState } from "@/components/board/useRotate";

/** Thin Shiloh-gold progress bar along the bottom edge showing time until auto-rotation. */
export default function RotateProgress() {
  const [state, setState] = useState<RotateProgressState>({
    durationMs: null,
    key: 0,
  });

  useEffect(() => {
    const onProgress = (e: Event) => {
      setState((e as CustomEvent<RotateProgressState>).detail);
    };
    window.addEventListener(ROTATE_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(ROTATE_PROGRESS_EVENT, onProgress);
  }, []);

  if (!state.durationMs) return null;
  return (
    <div className="rotateBar" aria-hidden>
      <div
        key={state.key}
        className="rotateFill"
        style={{ animationDuration: `${state.durationMs}ms` }}
      />
    </div>
  );
}
