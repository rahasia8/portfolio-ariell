import { createHash } from "node:crypto";
import { db } from "./db";
import { config } from "./config";
const windows = new Map<string, { start: number; hits: number }>();
export async function allowRequest(ip: string) {
  const key = createHash("sha256").update(ip).digest("hex");
  const c = config();
  if (c.DATABASE_URL) {
    const { rows } = await db().query(
      `INSERT INTO rate_limits(key) VALUES ($1)
      ON CONFLICT(key) DO UPDATE SET
      hits = CASE WHEN rate_limits.window_start < now() - interval '1 minute' THEN 1 ELSE rate_limits.hits + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - interval '1 minute' THEN now() ELSE rate_limits.window_start END
      RETURNING hits`,
      [key],
    );
    // Retain only active abuse-control counters, never conversation content.
    await db().query(
      "DELETE FROM rate_limits WHERE window_start < now() - interval '2 minutes'",
    );
    return rows[0].hits <= c.RATE_LIMIT_PER_MINUTE;
  }
  const now = Date.now();
  for (const [k, v] of windows) if (now - v.start >= 60000) windows.delete(k);
  const entry = windows.get(key) || { start: now, hits: 0 };
  entry.hits++;
  windows.set(key, entry);
  return entry.hits <= c.RATE_LIMIT_PER_MINUTE;
}
