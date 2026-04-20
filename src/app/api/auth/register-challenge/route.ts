import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db/client";
import { authChallenges, authCredentials } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const CHALLENGE_KEY = "default";

export async function POST() {
  try {
    const rows = await db.select().from(authCredentials).limit(1);
    const existing = rows[0];

    const options = await generateRegistrationOptions({
      rpName: "Coffee Brew Log",
      rpID: process.env.WEBAUTHN_RP_ID || "localhost",
      userID: new TextEncoder().encode("user"),
      userName: "user",
      userDisplayName: "Coffee Logger",
      attestationType: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      excludeCredentials: existing?.id
        ? [{ id: existing.id, transports: existing.transports as AuthenticatorTransport[] | undefined }]
        : [],
    });

    await db
      .insert(authChallenges)
      .values({ key: CHALLENGE_KEY, value: options.challenge, createdAt: new Date() })
      .onConflictDoUpdate({
        target: authChallenges.key,
        set: { value: options.challenge, createdAt: new Date() },
      });

    return NextResponse.json(options);
  } catch (err) {
    console.error("register-challenge error:", err);
    return NextResponse.json({ error: "Failed to generate challenge" }, { status: 500 });
  }
}
