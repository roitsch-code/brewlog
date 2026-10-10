import withPWA from "@ducanh2912/next-pwa";

const s3PublicPrefix = process.env.NEXT_PUBLIC_S3_PUBLIC_URL_PREFIX ?? "";
let s3Hostname;
try {
  s3Hostname = s3PublicPrefix ? new URL(s3PublicPrefix).hostname : undefined;
} catch {
  s3Hostname = undefined;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  allowedDevOrigins: ["172.20.10.2", "192.168.2.57", "192.168.1.*", "172.20.*"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=self, microphone=self, geolocation=()" },
        ],
      },
    ];
  },
  images: {
    // The optimizer is OFF (2026-10-10). Next 14.2.x serves /_next/image
    // BEFORE the middleware runs — verified against a local production build:
    // /coffees redirects to /login, /_next/image answers 200 with no cookie,
    // whatever the matcher says — so the cookie gate in src/middleware.ts
    // cannot protect it, and Next 14 has unpatched optimizer advisories incl.
    // an unauthenticated RCE via AVIF input (GHSA-2xp9-vwfh-vxw4, fixed only in
    // 15.5.24+). `unoptimized` makes every next/image a plain <img> (the only
    // consumer is the scan preview in PhotoUpload, which shows the S3 original
    // anyway), and the Caddyfile answers /_next/image* with 404 before the app
    // ever sees it. Real fix: the Next 15 migration.
    unoptimized: true,
    // Kept for the day the optimizer comes back, tightened meanwhile:
    // The optimizer fetches whatever upstream URL matches these patterns and
    // decodes it. `*.your-objectstorage.com` matched EVERY Hetzner Object
    // Storage bucket of every customer, so an attacker could park a crafted
    // file in their own bucket and have this server decode it (the Next 14
    // optimizer advisories, see src/middleware.ts). With the real bucket host
    // known from NEXT_PUBLIC_S3_PUBLIC_URL_PREFIX only that host is allowed;
    // the wildcard survives solely as the fallback for an env without it (CI).
    remotePatterns: [
      ...(s3Hostname
        ? [{ protocol: "https", hostname: s3Hostname }]
        : [{ protocol: "https", hostname: "*.your-objectstorage.com" }]),
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
};

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  // Offline document fallback — an uncached navigation while offline lands
  // on /offline instead of a browser error page. The brew shell (/coffees,
  // /brew/new) is precached via cacheOnFrontEndNav, so this is a safety net.
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);
