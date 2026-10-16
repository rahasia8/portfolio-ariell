import { normalizeLanguage } from "@/lib/locale";
import { getTranslation, loadSavedTranslation } from "@/lib/translate";
import { allowRequest } from "@/lib/rate-limit";
import { config } from "@/lib/config";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const language = normalizeLanguage(new URL(request.url).searchParams.get("locale"));
  if (!language) return Response.json({ error: "Unsupported language" }, { status: 400 });
  try {
    const saved = await loadSavedTranslation(language);
    if (saved)
      return Response.json(
        { locale: language, messages: saved },
        { headers: { "Cache-Control": "public, max-age=3600" } },
      );
    const ip =
      config().TRUST_PROXY === "true"
        ? request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "shared"
        : "shared";
    if (!(await allowRequest(ip)))
      return Response.json(
        { error: "Try again later" },
        { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
      );
    const messages = await getTranslation(language);
    return Response.json(
      { locale: language, messages },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch {
    return Response.json(
      { error: "Translation unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
