"use client";

import { useEffect, useState } from "react";
import styles from "./Stage.module.css";

/**
 * Fixed 1920x1080 canvas scaled to fit the screen, so every screen is designed
 * in TV pixels regardless of the WebView's real resolution or density.
 */
export default function Stage({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className={styles.viewport}>
      <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
