import { config, configured } from "@/lib/config";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (!config().DATABASE_URL)
      return Response.json(
        { status: "setup_required", knowledgeReady: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    const { rows } = await db().query(
      "SELECT count(*)::int AS count FROM knowledge_chunks WHERE visibility = 'public'",
    );
    return Response.json(
      {
        status: configured() ? "ok" : "setup_required",
        knowledgeReady: configured() && rows[0].count > 0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", knowledgeReady: false },
      { status: 503 },
    );
  }
}
