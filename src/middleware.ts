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
const STATIC_PATHS = ["/_next", "/favicon.ico", "/sw.js", "/swe-worker-", "/workbox-", "/fallback-", "/manifest.json", "/icons", "/screenshots"];

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|swe-worker-|workbox-|fallback-|manifest.json|icons|screenshots).*)"],
};
