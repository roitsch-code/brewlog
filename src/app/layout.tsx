import type { Metadata, Viewport } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "BrewLog",
  description: "Your personal coffee brew advisor & diary",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BrewLog",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0A0A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-167.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/icon-120.png" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
