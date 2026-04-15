import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// In-memory PIN rate limiting: ip → { count, lockedUntil }
const pinAttempts = new Map<string, { count: number; lockedUntil: number }>();
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 60_000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── PIN fallback ──────────────────────────────────────────────────────
    if (body.type === "pin") {
      const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
      const now = Date.now();
      const record = pinAttempts.get(ip);

      if (record && record.lockedUntil > now) {
        return NextResponse.json({ error: "Too many attempts. Try again in 60 seconds." }, { status: 429 });
      }

      const expected = process.env.AUTH_PIN;
      if (!expected) return NextResponse.json({ error: "PIN not configured" }, { status: 400 });

      if (body.pin !== expected) {
        const attempts = record && record.lockedUntil <= now ? record.count + 1 : 1;
        if (attempts >= PIN_MAX_ATTEMPTS) {
          pinAttempts.set(ip, { count: attempts, lockedUntil: now + PIN_LOCKOUT_MS });
        } else {
          pinAttempts.set(ip, { count: attempts, lockedUntil: 0 });
        }
        return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
      }

      pinAttempts.delete(ip);
      const token = await createSession();
      setSessionCookie(token);
      return NextResponse.json({ verified: true });
    }

    // ── Passkey / Face ID ─────────────────────────────────────────────────
    const db = getAdminDb();

    const [challengeSnap, credSnap] = await Promise.all([
      db.collection("auth").doc("challenge").get(),
      db.collection("auth").doc("credential").get(),
    ]);

    if (!challengeSnap.exists || !credSnap.exists) {
      return NextResponse.json({ error: "Missing challenge or credential" }, { status: 400 });
    }

    const challengeData = challengeSnap.data()!;
    const expectedChallenge = challengeData.value as string;

    // Enforce 2-minute TTL on WebAuthn challenges
    const CHALLENGE_TTL_MS = 2 * 60 * 1000;
    if (challengeData.createdAt && Date.now() - challengeData.createdAt > CHALLENGE_TTL_MS) {
      await db.collection("auth").doc("challenge").delete();
      return NextResponse.json({ error: "Challenge expired. Please try again." }, { status: 400 });
    }

    const stored = credSnap.data()!;

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: process.env.WEBAUTHN_ORIGIN || "http://localhost:3000",
      expectedRPID: process.env.WEBAUTHN_RP_ID || "localhost",
      credential: {
        id: stored.id,
        publicKey: Buffer.from(stored.publicKey, "base64url"),
        counter: stored.counter,
        transports: stored.transports,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "Verification failed" }, { status: 401 });
    }

    // Update counter (replay attack prevention)
    await db.collection("auth").doc("credential").update({
      counter: verification.authenticationInfo.newCounter,
    });

    // Clean up challenge
    await db.collection("auth").doc("challenge").delete();

    const token = await createSession();
    setSessionCookie(token);

    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
