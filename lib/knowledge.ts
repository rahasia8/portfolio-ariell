import { parse as parseYaml } from "yaml";
import { z } from "zod";
export const safeUrl = (url: string) =>
  (url.startsWith("/") && !url.startsWith("//") && !/[\\\s]/.test(url)) ||
  /^https?:\/\/[^\s]+$/i.test(url);
const documentSchema = z.object({
  id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .max(100),
  title: z.string().min(1).max(200),
  category: z.enum([
    "profile",
    "skill",
    "experience",
    "project",
    "education",
    "achievement",
    "working-style",
    "faq",
  ]),
  visibility: z.enum(["public", "private", "draft"]),
  updated_at: z.string().date(),
  version: z.number().int().positive(),
  source_url: z.string().refine(safeUrl).optional(),
  content: z.string().trim().min(1).max(200000),
});
export type KnowledgeDocument = z.infer<typeof documentSchema>;
export function parseDocument(raw: string, extension: string): KnowledgeDocument {
  if (extension === ".json") return documentSchema.parse(JSON.parse(raw));
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error("Markdown requires YAML frontmatter");
  const metadata: unknown = parseYaml(match[1], { maxAliasCount: 0 });
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    throw new Error("Invalid frontmatter");
  const data = { ...metadata, content: match[2] };
  return documentSchema.parse(data);
}
// Paragraph/heading-aware chunks; long sections overlap by roughly 50 tokens.
export function chunkText(content: string, size = 2400, overlap = 200): string[] {
  if (size < 100 || overlap < 0 || overlap >= size)
    throw new Error("Invalid chunk settings");
  const result: string[] = [];
  let pending = "";
  for (const paragraph of content
    .split(/\n\s*\n|(?=^#{1,3} )/m)
    .filter((p) => p.trim())) {
    if (pending && pending.length + paragraph.length + 2 > size) {
      result.push(pending.trim());
      pending = "";
    }
    let remaining = paragraph.trim();
    while (remaining.length > size) {
      let end = remaining.lastIndexOf(" ", size);
      if (end < size / 2) end = size;
      result.push(remaining.slice(0, end));
      remaining = remaining.slice(Math.max(1, end - overlap));
    }
    pending += (pending ? "\n\n" : "") + remaining;
  }
  if (pending.trim()) result.push(pending.trim());
  return result;
}
