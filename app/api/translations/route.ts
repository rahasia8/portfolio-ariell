import { normalizeLanguage } from "@/lib/locale";
import { loadSavedTranslation } from "@/lib/saved-translation";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const language = normalizeLanguage(new URL(request.url).searchParams.get("locale"));
  if (!language) return Response.json({ error: "Unsupported language" }, { status: 400 });
  try {
    const messages = await loadSavedTranslation(language);
    if (!messages)
      return Response.json(
        { error: "Local translation not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    return Response.json(
      { locale: language, messages },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch {
    return Response.json(
      { error: "Local translation unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
