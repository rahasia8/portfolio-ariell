import { z } from "zod";
import { getConnectionString, MissingDatabaseConnectionError } from "@netlify/database";
const schema = z.object({
  DATABASE_URL: z.string().trim().optional(),
  GEMINI_API_KEY: z.string().trim().optional(),
  EMBEDDING_MODEL: z
    .string()
    .regex(/^[a-zA-Z0-9._-]+$/)
    .default("gemini-embedding-001"),
  GENERATION_MODEL: z
    .string()
    .regex(/^[a-zA-Z0-9._-]+$/)
    .default("gemini-3.1-flash-lite"),
  TOP_K: z.coerce.number().int().min(1).max(10).default(5),
  RELEVANCE_THRESHOLD: z.coerce.number().min(-1).max(1).default(0.65),
  MAX_MESSAGE_LENGTH: z.coerce.number().int().min(1).max(4000).default(2000),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(12),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});
function databaseUrl() {
  try {
    // Netlify.env carries the request's database credentials. process.env can
    // contain the read-only URL exposed to the local CLI during a build.
    return getConnectionString();
  } catch (error) {
    if (!(error instanceof MissingDatabaseConnectionError)) throw error;
    return process.env.DATABASE_URL;
  }
}
export const config = () =>
  schema.parse({
    ...process.env,
    DATABASE_URL: databaseUrl(),
  });
export const configured = () => Boolean(config().DATABASE_URL && config().GEMINI_API_KEY);

export function requireSettings(keys: ("DATABASE_URL" | "GEMINI_API_KEY")[]) {
  const settings = config();
  const missing = keys.filter((key) => !settings[key]);
  if (missing.length)
    throw new Error(
      `Missing ${missing.join(", ")}. Set these in .env.local (copy .env.example first) or your shell environment.`,
    );
  return settings;
}
