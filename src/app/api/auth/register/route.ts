import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authChallenges, authCredentials } from "@/lib/db/schema";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/requireAuth";

export const dynamic = "force-dynamic";

const CHALLENGE_KEY = "default";
/** A registration challenge is single-use and short-lived, same as login's. */
const CHALLENGE_TTL_MS = 2 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    // WHO MAY REGISTER. This route sits under the `/api/auth` prefix that
    // src/middleware.ts exempts from the session cookie — it has to, or you
    // could never log in. Without the gate below that made it an open door:
    // the handler deletes the stored credential and mints a valid session, so
    // any stranger who could reach the domain could take the account over AND
    // lock the owner out of their own passkey. Two unauthenticated requests
    // (register-challenge, then register) were the whole attack, and the repo
    // is public, so the recipe was readable.
    //
    // Registration is allowed in exactly two states:
    //   (a) no credential exists — genuine first run, or straight after a
    //       reset. POST /api/auth/reset-passkey already requires a session, so
    //       only the owner can produce this state on a live install.
    //   (b) the caller already holds a valid session — re-enrolling a device.
    //
    // Every path the login page can take still works: a fresh install lands in
    // (a); with a credential present the page shows Face-ID login and never
    // offers registration; the PIN reset flow signs in FIRST and then resets,
    // so it satisfies both (a) and (b).
    const existing = await db.select({ id: authCredentials.id }).from(authCredentials).limit(1);
    if (existing.length > 0) {
      const authError = await requireAuth(req);
      if (authError) return authError;
    }

    const body = await req.json();

    const challengeRows = await db.select().from(authChallenges).where(eq(authChallenges.key, CHALLENGE_KEY)).limit(1);
    if (challengeRows.length === 0) {
      return NextResponse.json({ error: "No challenge found — start over" }, { status: 400 });
    }
    // Expire a stale challenge instead of honouring it forever — /api/auth/login
    // has always done this; registration was the one that didn't.
    if (Date.now() - challengeRows[0].createdAt.getTime() > CHALLENGE_TTL_MS) {
      await db.delete(authChallenges).where(eq(authChallenges.key, CHALLENGE_KEY));
      return NextResponse.json({ error: "Challenge expired. Please try again." }, { status: 400 });
    }
    const expectedChallenge = challengeRows[0].value;

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: process.env.WEBAUTHN_ORIGIN || "http://localhost:3000",
      expectedRPID: process.env.WEBAUTHN_RP_ID || "localhost",
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;
    const publicKey = Buffer.from(credential.publicKey).toString("base64url");
    const transports: string[] = body.response?.transports ?? [];

    await db.delete(authCredentials);
    await db.insert(authCredentials).values({
      id: credential.id,
      publicKey,
      counter: credential.counter,
      transports,
      createdAt: new Date(),
    });

    await db.delete(authChallenges).where(eq(authChallenges.key, CHALLENGE_KEY));

    const token = await createSession();
    setSessionCookie(token);

    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error("register error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
