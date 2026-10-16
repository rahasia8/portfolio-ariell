import type { NextConfig } from "next";
const isDevelopment = process.env.NODE_ENV === "development";
// React's development debugging requires eval; production scripts do not.
const scriptSources = "'self' 'unsafe-inline'" + (isDevelopment ? " 'unsafe-eval'" : "");
const connectionSources = "'self' https://ipapi.co" + (isDevelopment ? " ws: wss:" : "");
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src ${scriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src ${connectionSources}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
};
export default config;
