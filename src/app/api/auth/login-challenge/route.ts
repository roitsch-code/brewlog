import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db/client";
import { authChallenges, authCredentials } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const CHALLENGE_KEY = "default";

export async function POST() {
  try {
    const rows = await db.select().from(authCredentials).limit(1);
    const credential = rows[0];

    const options = await generateAuthenticationOptions({
      rpID: process.env.WEBAUTHN_RP_ID || "localhost",
      userVerification: "required",
      allowCredentials: credential?.id
        ? [{ id: credential.id, transports: credential.transports as AuthenticatorTransport[] | undefined }]
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
    console.error("login-challenge error:", err);
    return NextResponse.json({ error: "Failed to generate challenge" }, { status: 500 });
  }
}
