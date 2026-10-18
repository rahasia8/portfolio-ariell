import { countryLanguage, normalizeLanguage, type Language } from "./locale";
export async function detectVisitorLanguage(
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
  useHostingLookup = true,
): Promise<Language | null> {
  if (signal.aborted) return null;
  if (useHostingLookup) {
    try {
      const response = await fetcher("/api/locale", {
        signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        if (
          data.country &&
          /^[A-Z]{2}$/.test(data.country) &&
          normalizeLanguage(data.language)
        )
          return data.language;
      }
    } catch {
      if (signal.aborted) return null;
    }
  }
  if (signal.aborted) return null;
  try {
    // This request must originate in the visitor's browser, not on the app server.
    const response = await fetcher("https://ipapi.co/country/", {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const country = (await response.text()).trim();
    return /^[A-Z]{2}$/.test(country) && country !== "XX"
      ? countryLanguage(country)
      : null;
  } catch {
    return null;
  }
}
