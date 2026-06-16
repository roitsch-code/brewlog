import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// /api/loading-insights: the refresh sub-route is CRON_SECRET-gated and the GET
// read is requireAuth-gated, so both enforce their own auth past this allow.
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/research", "/api/admin", "/api/loading-insights"];
const STATIC_PATHS = ["/_next", "/favicon.ico", "/sw.js", "/manifest.json", "/icons", "/screenshots"];

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons|screenshots).*)"],
};
