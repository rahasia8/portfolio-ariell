import { headers } from "next/headers";
import Portfolio from "@/components/portfolio";
import { requestLanguage } from "@/lib/locale";
export default async function Home() {
  const { language } = requestLanguage(await headers());
  const locationProvider =
    process.env.LOCATION_PROVIDER ?? (process.env.VERCEL === "1" ? "vercel" : "none");
  return (
    <Portfolio
      initialLanguage={language}
      useHostingLookup={["vercel", "cloudflare"].includes(locationProvider)}
      name={process.env.NEXT_PUBLIC_OWNER_NAME || "Your name"}
      role={process.env.NEXT_PUBLIC_OWNER_ROLE || "Software Engineer"}
    />
  );
}
