import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/api/auth"];
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
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
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
