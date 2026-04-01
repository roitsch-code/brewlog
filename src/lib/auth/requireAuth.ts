import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "./session";

/**
 * Belt-and-suspenders auth check for route handlers.
 * Middleware already covers most cases, but this protects expensive
 * Claude API routes if middleware is ever misconfigured or bypassed.
 *
 * Usage:
 *   const authError = await requireAuth(req);
 *   if (authError) return authError;
 */
export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  const token = req.cookies.get("cf_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const valid = await verifySession(token);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
