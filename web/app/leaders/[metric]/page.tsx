import { notFound } from "next/navigation";
import { METRICS } from "@/lib/board";
import Leaderboard from "./Leaderboard";

export function generateStaticParams() {
  return Object.keys(METRICS).map((metric) => ({ metric }));
}

export default async function Page({ params }: { params: Promise<{ metric: string }> }) {
  const { metric } = await params;
  if (!METRICS[metric]) notFound();
  return <Leaderboard slug={metric} />;
}
