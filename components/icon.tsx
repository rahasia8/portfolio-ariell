import type { CSSProperties } from "react";

type IconName =
  | "bot"
  | "chat"
  | "experience"
  | "projects"
  | "skills"
  | "contact"
  | "refresh"
  | "send"
  | "external"
  | "shield";
const paths: Record<Exclude<IconName, "bot">, React.ReactNode> = {
  chat: <path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z M7 10h8M7 14h5" />,
  experience: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="3" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a22 22 0 0 0 18 0M12 11v4" />
    </>
  ),
  projects: (
    <path d="M3 8V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z M3 10h18" />
  ),
  skills: <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16" />,
  contact: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  refresh: <path d="M20 10a8 8 0 1 0-1 8M20 4v6h-6" />,
  send: <path d="m21 3-7 18-4-7-7-4 18-7ZM10 14l5-5" />,
  external: (
    <path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
  ),
  shield: <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6" />,
};
export default function Icon({
  name,
  size = 20,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      {name === "bot" ? (
        <>
          <path d="M12 3v3M3 12H1m22 0h-2" />
          <circle cx="12" cy="2" r="1" fill="currentColor" stroke="none" />
          <rect x="3" y="6" width="18" height="15" rx="5" />
          <rect x="6" y="10" width="5" height="4" rx="1.5" />
          <rect x="13" y="10" width="5" height="4" rx="1.5" />
          <path d="M11 11h2m-4 6h6" />
        </>
      ) : (
        paths[name]
      )}
    </svg>
  );
}
