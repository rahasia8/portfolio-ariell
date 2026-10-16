import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { escapeLiteral } from "pg";
import { config, requireSettings } from "../lib/config";
import { prepareKnowledge } from "../lib/ingestion";
import { parseDocument } from "../lib/knowledge";
import { GeminiEmbedding } from "../lib/providers";

async function files(dir: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ["templates", "README.md"].includes(entry.name))
      continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await files(file)));
    else if (/\.(md|json)$/.test(entry.name)) result.push(file);
  }
  return result.sort();
}

try {
  const documents = await Promise.all(
    (await files("knowledge")).map(async (file) =>
      parseDocument(await readFile(file, "utf8"), path.extname(file)),
    ),
  );
  const publicDocuments = documents.filter((d) => d.visibility === "public");
  const model = config().EMBEDDING_MODEL;
  const hash = createHash("sha256")
    .update(JSON.stringify({ model, documents: publicDocuments }))
    .digest("hex");
  const directory = "netlify/database/migrations";
  await mkdir(directory, { recursive: true });
  const existing = (await readdir(directory))
    .filter((file) => /^\d+_knowledge_[a-f0-9]+\.sql$/.test(file))
    .sort();
  const latest = existing.at(-1);
  if (latest?.endsWith(`_knowledge_${hash}.sql`)) {
    console.log("Knowledge migration is current. No embeddings requested.");
  } else if (process.argv.includes("--check")) {
    throw new Error(
      "Knowledge changed. Run npm run knowledge:migration before deploying.",
    );
  } else {
    requireSettings(["GEMINI_API_KEY"]);
    const rows = await prepareKnowledge(
      documents,
      new GeminiEmbedding(),
      process.argv.includes("--allow-empty"),
    );
    const literal = (value: string | number | null) =>
      value === null ? "NULL" : escapeLiteral(String(value));
    const statements = rows.map(({ document: d, content, embedding, index }) => {
      const values = [
        createHash("sha256").update(`${d.id}:${d.version}:${index}`).digest("hex"),
        d.id,
        content,
        embedding,
        model,
        d.title,
        d.category,
        "public",
        d.source_url || null,
        d.version,
        d.updated_at,
        index,
      ];
      return `INSERT INTO knowledge_chunks (id,source_id,content,embedding,embedding_model,title,category,visibility,source_url,version,updated_at,chunk_index) VALUES (${values.map(literal).join(",")});`;
    });
    const timestamp = Math.max(Date.now(), Number(latest?.split("_")[0] || 0) + 1);
    const filename = `${timestamp}_knowledge_${hash}.sql`;
    // Netlify applies each migration transactionally before publishing the deploy.
    await writeFile(
      path.join(directory, filename),
      [
        "-- Generated public knowledge snapshot. Keep applied migrations unchanged.",
        "SELECT pg_advisory_xact_lock(8743291);",
        "DELETE FROM knowledge_chunks;",
        ...statements,
        "",
      ].join("\n"),
      { flag: "wx" },
    );
    console.log(
      `Prepared ${publicDocuments.length} public documents / ${rows.length} chunks in ${filename}.`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Knowledge migration failed.");
  process.exitCode = 1;
}
