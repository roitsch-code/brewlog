import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authChallenges, authCredentials } from "@/lib/db/schema";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const CHALLENGE_KEY = "default";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const challengeRows = await db.select().from(authChallenges).where(eq(authChallenges.key, CHALLENGE_KEY)).limit(1);
    if (challengeRows.length === 0) {
      return NextResponse.json({ error: "No challenge found — start over" }, { status: 400 });
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
