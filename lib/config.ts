import { z } from "zod";
import { getConnectionString, MissingDatabaseConnectionError } from "@netlify/database";
const schema = z.object({
  DATABASE_URL: z.string().trim().optional(),
  GROQ_API_KEY: z.string().trim().optional(),
  GROQ_MODEL: z
    .string()
    .regex(/^[a-zA-Z0-9._/-]+$/)
    .default("openai/gpt-oss-20b"),
  TOP_K: z.coerce.number().int().min(1).max(10).default(5),
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
export const configured = () => {
  const c = config();
  return Boolean(c.DATABASE_URL && c.GROQ_API_KEY);
};

export function requireSettings(keys: ("DATABASE_URL" | "GROQ_API_KEY")[]) {
  const settings = config();
  const missing = keys.filter((key) => !settings[key]);
  if (missing.length)
    throw new Error(
      `Missing ${missing.join(", ")}. Set these in .env.local (copy .env.example first) or your shell environment.`,
    );
  return settings;
}

/** Identifier stored with text-only snapshots; never used as an embedding model. */
export const FULLTEXT_INDEX = "postgres-fulltext-v1";
export function knowledgeIndex() {
  return FULLTEXT_INDEX;
}
