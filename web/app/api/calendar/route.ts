import { NextResponse } from "next/server";
import { upcomingEvents, type Calendar } from "@/lib/ics";

// Reads the subscribed sportsYou calendar (an .ics link). The link is private,
// so it lives only in the Vercel env var CALENDAR_ICS_URL and is never sent to the TV.
export const dynamic = "force-dynamic";

let lastGood: Calendar | null = null;

export async function GET() {
  const raw = process.env.CALENDAR_ICS_URL?.trim();
  if (!raw) return NextResponse.json({ error: "calendar not configured", missing: ["CALENDAR_ICS_URL"] }, { status: 503 });
  const url = raw.replace(/^webcals?:\/\//i, "https://");

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/calendar, */*" },
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`calendar upstream ${res.status}`);
    const data: Calendar = { events: upcomingEvents(await res.text(), Date.now(), 40, 3), updated: new Date().toISOString() };
    lastGood = data;
    return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=60" } });
  } catch (err) {
    // Log the reason only, never the URL.
    console.error("calendar fetch failed:", err instanceof Error ? err.message : err);
    if (lastGood) return NextResponse.json({ ...lastGood, stale: true });
    return NextResponse.json({ error: "calendar unavailable" }, { status: 503 });
  }
}
