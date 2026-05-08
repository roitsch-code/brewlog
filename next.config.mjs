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
    remotePatterns: [
      ...(s3Hostname ? [{ protocol: "https", hostname: s3Hostname }] : []),
      { protocol: "https", hostname: "*.your-objectstorage.com" },
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
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);
