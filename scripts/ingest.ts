import { prepareKnowledge, publishKnowledge } from "../lib/ingestion";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db, closeDb } from "../lib/db";
import { requireSettings, knowledgeIndex } from "../lib/config";
import { parseDocument, type KnowledgeDocument } from "../lib/knowledge";
async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const result: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "templates" || e.name === "README.md")
      continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) result.push(...(await files(p)));
    else if (/\.(md|json)$/.test(e.name)) result.push(p);
  }
  return result;
}
async function main() {
  requireSettings(["DATABASE_URL"]);
  try {
    await db().query("SELECT 1 FROM knowledge_chunks LIMIT 1");
  } catch {
    throw new Error(
      "Knowledge database is not ready. Check DATABASE_URL in .env.local, start PostgreSQL, and run npm run db:migrate before ingestion. No embeddings were requested.",
    );
  }
  const documents: KnowledgeDocument[] = [];
  for (const file of await files("knowledge"))
    documents.push(parseDocument(await readFile(file, "utf8"), path.extname(file)));
  const rows = await prepareKnowledge(documents, process.argv.includes("--allow-empty"));
  await publishKnowledge(db(), rows, knowledgeIndex());
  console.log(
    `Published ${documents.filter((d) => d.visibility === "public").length} documents / ${rows.length} chunks. Removed deleted, private, and old-version sources.`,
  );
}
try {
  await main();
} catch (e) {
  console.error(e instanceof Error ? e.message : "Ingestion failed");
  process.exitCode = 1;
} finally {
  await closeDb();
}
