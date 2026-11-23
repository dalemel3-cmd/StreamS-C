import { NextResponse } from "next/server";
import { weatherLabel, type Weather } from "@/lib/weather";

// Open-Meteo, no API key. The upstream fetch is cached 10 min; the handler itself
// runs per request so a failed fetch at build time can't get baked in.
export const dynamic = "force-dynamic";
const revalidate = 600;

const LAT = process.env.WEATHER_LAT ?? "36.3729"; // Bentonville, AR
const LON = process.env.WEATHER_LON ?? "-94.2088";
const TZ = process.env.WEATHER_TZ ?? "America/Chicago";

// Last good response, kept per server instance so an upstream outage returns stale data, not an error.
let lastGood: Weather | null = null;

export async function GET() {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${LAT}&longitude=${LON}` +
    "&current=temperature_2m,apparent_temperature,weather_code,is_day" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&temperature_unit=fahrenheit&forecast_days=1" +
    `&timezone=${encodeURIComponent(TZ)}`;

  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const j = await res.json();
    const data: Weather = {
      tempF: Math.round(j.current.temperature_2m),
      feelsF: Math.round(j.current.apparent_temperature),
      highF: Math.round(j.daily.temperature_2m_max[0]),
      lowF: Math.round(j.daily.temperature_2m_min[0]),
      precipPct: Math.round(j.daily.precipitation_probability_max[0] ?? 0),
      code: j.current.weather_code,
      label: weatherLabel(j.current.weather_code),
      isDay: j.current.is_day === 1,
      updated: new Date().toISOString(),
    };
    lastGood = data;
    return NextResponse.json(data);
  } catch (err) {
    console.error("weather fetch failed:", err);
    if (lastGood) return NextResponse.json({ ...lastGood, stale: true });
    return NextResponse.json({ error: "weather unavailable" }, { status: 503 });
  }
}
