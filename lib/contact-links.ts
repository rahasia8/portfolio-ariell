export type ContactPart = { text: string; href?: string; external?: boolean };

/** Link only email addresses and HTTPS LinkedIn pages; never interpret HTML. */
export function contactLinks(text: string): ContactPart[] {
  const pattern =
    /https?:\/\/[^\s<>"\u0027]+|(?:www\.)?linkedin\.com\/[^\s<>"\u0027]+|[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+/gi;
  const parts: ContactPart[] = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    if (start > end) parts.push({ text: text.slice(end, start) });
    const label = match[0].replace(/[.,;:!?\)\]\}]+$/u, "");
    let href: string | undefined;
    let external = false;
    // Do not recognize a bare domain embedded in another domain or URL.
    if (!start || !/[\w@./:-]/u.test(text[start - 1])) {
      if (label.includes("@") && !label.includes("://")) {
        href = `mailto:${label}`;
      } else {
        try {
          const url = new URL(/^https?:\/\//i.test(label) ? label : `https://${label}`);
          if (
            ["linkedin.com", "www.linkedin.com"].includes(url.hostname.toLowerCase()) &&
            ["https:", "http:"].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            !url.port
          ) {
            url.protocol = "https:";
            href = url.href;
            external = true;
          }
        } catch {
          /* Leave malformed text unchanged. */
        }
      }
    }
    parts.push({ text: label, ...(href ? { href, external } : {}) });
    const suffix = match[0].slice(label.length);
    if (suffix) parts.push({ text: suffix });
    end = start + match[0].length;
  }
  if (end < text.length) parts.push({ text: text.slice(end) });
  return parts;
}
