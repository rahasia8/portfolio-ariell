import { configured, requireSettings } from "../lib/config";
import { closeDb } from "../lib/db";
import { retrieve, answerFromChunks } from "../lib/rag";

// Live verification: public sources and synthetic questions only; never log keys.
const checks = [
  { question: "Apa pendidikan Ariell?", language: "id", source: "ariell-resume" },
  { question: "Who won the latest football match?", language: "en", source: null },
] as const;
try {
  requireSettings(["DATABASE_URL", "GROQ_API_KEY"]);
  if (!configured()) throw new Error("RAG is not configured");
  for (const check of checks) {
    const chunks = await retrieve(check.question);
    const result = await answerFromChunks(
      check.question,
      chunks,
      [],
      undefined,
      check.language,
    );
    const passed = check.source
      ? !result.fallback &&
        result.sources.some((source) => source.sourceId === check.source)
      : result.fallback && result.sources.length === 0;
    console.log(
      JSON.stringify({
        check: check.source
          ? "grounded_indonesian_answer"
          : "unrelated_question_fallback",
        passed,
        retrieved: chunks.length,
        sourceIds: result.sources.map((source) => source.sourceId),
        fallback: result.fallback,
      }),
    );
    if (!passed) process.exitCode = 1;
  }
} catch (error) {
  const status =
    error && typeof error === "object" && "status" in error ? error.status : undefined;
  console.error(JSON.stringify({ event: "rag_check_failed", providerStatus: status }));
  process.exitCode = 1;
} finally {
  await closeDb();
}
