import { notFound } from "next/navigation";
import { CLUBS } from "./clubs";
import ClubBoard from "./ClubBoard";

export function generateStaticParams() {
  return Object.keys(CLUBS).map((club) => ({ club }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ club: string }>;
}) {
  const { club } = await params;
  if (!CLUBS[club]) notFound();
  return <ClubBoard slug={club} />;
}
