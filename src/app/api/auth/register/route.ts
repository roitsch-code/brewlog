import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getAdminDb();

    // Retrieve stored challenge
    const challengeSnap = await db.collection("auth").doc("challenge").get();
    if (!challengeSnap.exists) {
      return NextResponse.json({ error: "No challenge found — start over" }, { status: 400 });
    }
    const expectedChallenge = challengeSnap.data()!.value as string;

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

    // Store credential — base64url encode the Uint8Array fields for Firestore
    await db.collection("auth").doc("credential").set({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: body.response?.transports ?? [],
      createdAt: new Date().toISOString(),
    });

    // Clean up challenge
    await db.collection("auth").doc("challenge").delete();

    // Create session
    const token = await createSession();
    setSessionCookie(token);

    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error("register error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
