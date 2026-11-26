"use client";

import { usePathname } from "next/navigation";

/** TV-only overlays and key handlers. The web remote (/remote) is a normal page and skips them. */
export default function TvChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  if (path === "/remote" || path.startsWith("/remote/")) return null;
  return <>{children}</>;
}
