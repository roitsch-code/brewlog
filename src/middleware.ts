import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// /api/loading-insights: the refresh sub-route is CRON_SECRET-gated and the GET
// read is requireAuth-gated, so both enforce their own auth past this allow.
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/research", "/api/admin", "/api/loading-insights"];
// The next-pwa service worker is `/sw.js`, and it importScripts() three hashed
// helpers from the site root at install/activate time: `/workbox-<hash>.js`,
// `/swe-worker-<hash>.js` and `/fallback-<hash>.js`. All four must reach the
// browser as their real JS files — if the auth gate redirects any of them to
// /login (307 → HTML), importScripts() throws, the SW can never install or
// UPDATE, and an installed PWA stays frozen on its old precached shell whose
// chunk hashes 404 after a deploy → "opens but no buttons". Exempt them by
// prefix (the hashes change every build). Keep this list in sync with the
// `config.matcher` negative-lookahead below — the matcher decides whether
// middleware runs at all, this array is the belt-and-braces runtime guard.
//
// `/_next/static` only — NOT the bare `/_next` prefix (2026-10-10). The bare
// prefix also waved through `/_next/image`, the image optimizer, which
// answered UNAUTHENTICATED requests from the public internet while Next 14.2.x
// carries unpatched optimizer advisories (incl. an unauthenticated RCE via AVIF
// input, GHSA-2xp9-vwfh-vxw4, fixed only in 15.5.24+).
//
// BUT: this middleware CANNOT gate that route. Verified the same day against a
// local production build and live after deploy: Next 14 serves `/_next/image`
// BEFORE the middleware runs (200 with no cookie, `x-nextjs-cache: HIT`) while
// `/coffees` redirects to `/login` — the matcher below does not reach it. The
// real closure is `images.unoptimized: true` in next.config.mjs (no consumer
// needs the optimizer) plus `respond 404` for `/_next/image*` in the
// Caddyfile. Pinned by tests/dataflow/middleware-image-gate.test.mjs.
const STATIC_PATHS = ["/_next/static", "/favicon.ico", "/sw.js", "/swe-worker-", "/workbox-", "/fallback-", "/manifest.json", "/icons", "/screenshots"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static assets and public paths through
  if (STATIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get("cf_session")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    if (!process.env.AUTH_SECRET) {
      console.error("AUTH_SECRET environment variable is not set");
      return new NextResponse("Server misconfiguration", { status: 500 });
    }
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("cf_session");
    return res;
  }
}

export const config = {
  // `_next/image` is deliberately NOT excluded here — see STATIC_PATHS above.
  matcher: ["/((?!_next/static|favicon.ico|sw.js|swe-worker-|workbox-|fallback-|manifest.json|icons|screenshots).*)"],
};
