import { headers } from "next/headers";
import { languageDirection, requestLanguage } from "@/lib/locale";
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ariellbot | Ariell’s AI Resume",
  description:
    "Meet ariellbot, Ariell’s AI resume. Explore his experience, projects, and skills through conversation.",
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { language } = requestLanguage(await headers());
  return (
    <html lang={language} dir={languageDirection(language)}>
      <body>{children}</body>
    </html>
  );
}
