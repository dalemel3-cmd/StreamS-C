// Shared weather types + WMO code labels (Open-Meteo uses WMO weather codes).

export type Weather = {
  tempF: number;
  feelsF: number;
  highF: number;
  lowF: number;
  precipPct: number;
  code: number;
  label: string;
  isDay: boolean;
  updated: string; // ISO time the data was fetched
  stale?: boolean;
};

const LABELS: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorms",
  96: "Storms + hail",
  99: "Storms + hail",
};

export function weatherLabel(code: number): string {
  return LABELS[code] ?? "—";
}
