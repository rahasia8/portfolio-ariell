import { headers } from "next/headers";
import Portfolio from "@/components/portfolio";
import { requestLanguage } from "@/lib/locale";
export default async function Home() {
  const { language } = requestLanguage(await headers());
  return (
    <Portfolio
      initialLanguage={language}
      name={process.env.NEXT_PUBLIC_OWNER_NAME || "Your name"}
      role={process.env.NEXT_PUBLIC_OWNER_ROLE || "Software Engineer"}
    />
  );
}
