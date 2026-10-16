import { readFile } from "node:fs/promises";
import { db, closeDb } from "../lib/db";
import { requireSettings } from "../lib/config";
try {
  requireSettings(["DATABASE_URL"]);
  try {
    await db().query(await readFile("db/001_initial.sql", "utf8"));
  } catch {
    throw new Error(
      "Database migration failed. Check DATABASE_URL in .env.local, start PostgreSQL, and ensure pgvector is available and your database user can create the extension and tables.",
    );
  }
  console.log("Database schema ready.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Database migration failed.");
  process.exitCode = 1;
} finally {
  await closeDb();
}
