import { headers } from "next/headers";
import { languageDirection, requestLanguage } from "@/lib/locale";
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Personal AI Portfolio",
  description:
    "Explore professional experience, projects, and engineering decisions through a source-backed conversation.",
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { language } = requestLanguage(await headers());
  return (
    <html lang={language} dir={languageDirection(language)}>
      <body>{children}</body>
    </html>
  );
}
