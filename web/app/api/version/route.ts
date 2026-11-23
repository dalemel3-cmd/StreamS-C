// Identifies the live deployment so open screens can reload themselves after a deploy.
export const dynamic = "force-dynamic";

export function GET() {
  const id = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
  return Response.json({ id }, { headers: { "Cache-Control": "no-store" } });
}
