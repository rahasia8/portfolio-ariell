export function allowedRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (origin === new URL(request.url).origin) return true;
  // A hosting proxy can expose an internal URL to the Next.js handler. Only
  // trust a public origin configured by the operator, never forwarded headers.
  if (!process.env.APP_ORIGIN) return false;
  try {
    const configured = new URL(process.env.APP_ORIGIN);
    return (
      ["https:", "http:"].includes(configured.protocol) && origin === configured.origin
    );
  } catch {
    return false;
  }
}
