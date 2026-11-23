import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mason TV",
  robots: { index: false, follow: false },
};

// device-width (not 1920): Android TV WebViews report a ~960x540 CSS viewport at DPR 2.
// A fixed width=1920 plus initial-scale=1 made the stick show only the top-left quarter.
// <Stage> scales the 1920x1080 canvas to whatever the viewport is.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
