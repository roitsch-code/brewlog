import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authChallenges, authCredentials } from "@/lib/db/schema";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const pinAttempts = new Map<string, { count: number; lockedUntil: number }>();
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 60_000;
const CHALLENGE_KEY = "default";
const CHALLENGE_TTL_MS = 2 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

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

    const [challengeRows, credentialRows] = await Promise.all([
      db.select().from(authChallenges).where(eq(authChallenges.key, CHALLENGE_KEY)).limit(1),
      db.select().from(authCredentials).limit(1),
    ]);

    const challenge = challengeRows[0];
    const stored = credentialRows[0];
    if (!challenge || !stored) {
      return NextResponse.json({ error: "Missing challenge or credential" }, { status: 400 });
    }

    if (Date.now() - challenge.createdAt.getTime() > CHALLENGE_TTL_MS) {
      await db.delete(authChallenges).where(eq(authChallenges.key, CHALLENGE_KEY));
      return NextResponse.json({ error: "Challenge expired. Please try again." }, { status: 400 });
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge.value,
      expectedOrigin: process.env.WEBAUTHN_ORIGIN || "http://localhost:3000",
      expectedRPID: process.env.WEBAUTHN_RP_ID || "localhost",
      credential: {
        id: stored.id,
        publicKey: Buffer.from(stored.publicKey, "base64url"),
        counter: stored.counter,
        transports: stored.transports as AuthenticatorTransport[] | undefined,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "Verification failed" }, { status: 401 });
    }

    await db
      .update(authCredentials)
      .set({ counter: verification.authenticationInfo.newCounter })
      .where(eq(authCredentials.id, stored.id));

    await db.delete(authChallenges).where(eq(authChallenges.key, CHALLENGE_KEY));

    const token = await createSession();
    setSessionCookie(token);

    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
