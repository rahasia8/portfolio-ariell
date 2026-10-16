import { Pool } from "pg";
import { config } from "./config";
const globalDb = globalThis as unknown as { portfolioPool?: Pool };
export function db() {
  if (!config().DATABASE_URL) throw new Error("Database is not configured");
  return (globalDb.portfolioPool ??= new Pool({
    connectionString: config().DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    statement_timeout: 8000,
  }));
}
export function vector(values: number[]) {
  if (
    values.length !== 768 ||
    values.some((v) => !Number.isFinite(v)) ||
    values.every((v) => v === 0)
  )
    throw new Error("Invalid embedding");
  return `[${values.join(",")}]`;
}

export async function closeDb() {
  const pool = globalDb.portfolioPool;
  if (pool) {
    globalDb.portfolioPool = undefined;
    await pool.end();
  }
}
