import { normalizeLanguage } from "./locale";
import { z } from "zod";
export const chatSchema = (maxLength: number) =>
  z
    .object({
      message: z.string().trim().min(1).max(maxLength),
      locale: z
        .string()
        .max(35)
        .refine((value) => normalizeLanguage(value) !== null, "Unsupported locale")
        .transform((value) => normalizeLanguage(value)!)
        .optional(),
      conversationId: z.string().uuid().optional(),
      history: z
        .array(
          z
            .object({
              role: z.enum(["user", "assistant"]),
              content: z.string().trim().min(1).max(4000),
            })
            .strict(),
        )
        .max(6)
        .default([]),
    })
    .strict();
export async function readBoundedJson(request: Request, limit = 32000) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("Unsupported body");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = Buffer.concat(parts);
  return JSON.parse(body.toString("utf8"));
}
