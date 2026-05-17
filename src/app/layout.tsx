import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { JetBrains_Mono, Instrument_Serif, Fraunces, Chivo } from "next/font/google";
import "./globals.css";
import ScrollContainer from "@/components/layout/ScrollContainer";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

// Light System §3.1 (anthracite revision) — Fraunces for hero questions,
// Chivo for body text inside the (light) route group. Variables are
// exposed globally so the (light) scope can opt in via `font-fraunces`
// / `font-chivo` Tailwind utilities. Dark-scope consumers continue to
// use Instrument Serif / Geist.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});

const chivo = Chivo({
  subsets: ["latin"],
  weight: ["200", "400", "500", "600"],
  variable: "--font-chivo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bettertastethansorry.com"),
  title: "BrewLog",
  description: "Your personal coffee brew advisor & diary",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BrewLog",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#D4B8C9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} ${fraunces.variable} ${chivo.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-167.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/icon-120.png" />
      </head>
      <body className="antialiased">
        <ScrollContainer>
          {children}
        </ScrollContainer>
      </body>
    </html>
  );
}
