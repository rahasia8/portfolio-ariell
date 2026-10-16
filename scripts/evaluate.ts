import { readFile } from "node:fs/promises";
import { configured } from "../lib/config";
import { retrieve, answerFromChunks, fallback } from "../lib/rag";
import { db } from "../lib/db";
type Case = {
  id: string;
  question: string;
  expectFallback: boolean;
  expectedSourceIds: string[];
};
const cases: Case[] = JSON.parse(
  await readFile("tests/evaluation/questions.json", "utf8"),
);
let failures = 0;
try {
  for (const test of cases) {
    const chunks = configured() ? await retrieve(test.question) : [];
    const result = configured()
      ? await answerFromChunks(test.question, chunks, [])
      : { answer: fallback(test.question), sources: [], fallback: true };
    const ids = chunks.map((c) => c.source_id);
    const recall = test.expectedSourceIds.length
      ? test.expectedSourceIds.filter((id) => ids.includes(id)).length /
        test.expectedSourceIds.length
      : 1;
    const passed = result.fallback === test.expectFallback && recall === 1;
    if (!passed) failures++;
    console.log(
      JSON.stringify({
        id: test.id,
        passed,
        retrievalRecall: recall,
        fallback: result.fallback,
        sourceIds: result.sources.map((s) => s.sourceId),
      }),
    );
  }
  console.log(
    `${cases.length - failures}/${cases.length} cases passed. ${configured() ? "Review groundedness manually as well." : "Empty-data evaluation only: configure credentials and real source expectations to evaluate RAG."}`,
  );
  if (failures) process.exitCode = 1;
} finally {
  if (configured()) await db().end();
}
