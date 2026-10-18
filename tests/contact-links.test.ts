import { expect, it } from "vitest";
import { contactLinks } from "../lib/contact-links";
it("links contact details while preserving text and punctuation", () => {
  const text =
    "Email: ariell+work@example.com.\nLinkedIn: https://www.linkedin.com/in/ariell).";
  const parts = contactLinks(text);
  expect(parts.map((p) => p.text).join("")).toBe(text);
  expect(parts.filter((p) => p.href)).toEqual([
    {
      text: "ariell+work@example.com",
      href: "mailto:ariell+work@example.com",
      external: false,
    },
    {
      text: "https://www.linkedin.com/in/ariell",
      href: "https://www.linkedin.com/in/ariell",
      external: true,
    },
  ]);
});
it("supports bare LinkedIn profiles and upgrades HTTP", () => {
  for (const text of [
    "linkedin.com/in/ariell",
    "www.linkedin.com/in/ariell",
    "http://www.linkedin.com/in/ariell",
  ]) {
    expect(contactLinks(text)[0]).toMatchObject({ external: true });
    expect(contactLinks(text)[0].href).toMatch(/^https:\/\//);
  }
});
it("leaves unrelated or deceptive URLs as plain text", () => {
  for (const text of [
    "https://linkedin.com.evil.com/in/user",
    "https://evil.com/linkedin.com/in/user",
    "evil.linkedin.com/in/user",
    "https://user@linkedin.com/in/user",
    "<script>alert(1)</script>",
  ]) {
    const parts = contactLinks(text);
    expect(parts.some((p) => p.href)).toBe(false);
    expect(parts.map((p) => p.text).join("")).toBe(text);
  }
});
