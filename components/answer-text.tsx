import { contactLinks } from "@/lib/contact-links";

export default function AnswerText({
  text,
  opensNewTab,
}: {
  text: string;
  opensNewTab: string;
}) {
  return contactLinks(text).map((part, index) =>
    part.href ? (
      <a
        key={index}
        href={part.href}
        target={part.external ? "_blank" : undefined}
        rel={part.external ? "noopener noreferrer" : undefined}
      >
        {part.text}
        {part.external && <span className="sr-only"> ({opensNewTab})</span>}
      </a>
    ) : (
      part.text
    ),
  );
}
