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
  title: "BTTS",
  description: "Your personal coffee brew advisor & diary",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BTTS",
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
        {/* Stale-chunk self-heal. After a deploy, an installed PWA / WKWebView
            can hold a cached HTML shell that references JS chunk filenames the
            new build no longer has → "Application error: a client-side
            exception" (a ChunkLoadError). The brew flow loads its step chunks
            lazily, so the crash lands exactly when you cross into the recipe /
            brew step. A plain location.reload() reuses the service-worker cache
            and re-fetches the SAME stale shell → the old one-shot reload couldn't
            recover and left a black screen. So on a chunk error we first PURGE
            the Cache Storage + unregister the service worker, THEN reload, so the
            fresh shell + new chunks actually load. One-shot per session via
            sessionStorage → no reload loop (a persistently-broken chunk shows the
            error rather than looping; a fresh app launch resets the flag). A
            1.5s watchdog reloads even if the cache purge hangs. Caused by the
            June-2026 widget-deploy incident — see docs/ios-shell-roadmap. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var K='btts_chunk_reloaded';function c(m){return /ChunkLoadError|Loading chunk [\\w-]+ failed|Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(m||'')}function h(m){if(!c(m))return;try{if(sessionStorage.getItem(K))return;sessionStorage.setItem(K,'1')}catch(e){}var done=false;function go(){if(done)return;done=true;location.reload()}try{var t=[];if(window.caches&&caches.keys){t.push(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}))}if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations){t.push(navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))}))}Promise.all(t).then(go).catch(go);setTimeout(go,1500)}catch(e){go()}}window.addEventListener('error',function(e){h((e&&e.message)||(e&&e.error&&e.error.message)||'')},true);window.addEventListener('unhandledrejection',function(e){var r=e&&e.reason;h((r&&r.message)||String(r||''))})}catch(e){}})();",
          }}
        />
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
