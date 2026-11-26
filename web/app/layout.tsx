import type { Metadata, Viewport } from "next";
import "./globals.css";
import AutoReload from "@/components/AutoReload";
import RotateLock from "@/components/RotateLock";
import RotateProgress from "@/components/RotateProgress";
import ScreenMenu from "@/components/ScreenMenu";

export const metadata: Metadata = {
  title: "HPD TV",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=Oswald:wght@400;600;700&display=swap"
        />
      </head>
      <body>
        {children}
        <AutoReload />
        <RotateProgress />
        <RotateLock />
        <ScreenMenu />
      </body>
    </html>
  );
}
