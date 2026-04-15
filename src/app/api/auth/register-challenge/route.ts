import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getAdminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const db = getAdminDb();

    // Check if a credential already exists
    const credSnap = await db.collection("auth").doc("credential").get();
    const existing = credSnap.exists ? credSnap.data() : null;

    const options = await generateRegistrationOptions({
      rpName: "Coffee Brew Log",
      rpID: process.env.WEBAUTHN_RP_ID || "localhost",
      userID: new TextEncoder().encode("user"),
      userName: "user",
      userDisplayName: "Coffee Logger",
      attestationType: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform", // Face ID / Touch ID only
        userVerification: "required",
        residentKey: "preferred",
      },
      excludeCredentials: existing?.id ? [{ id: existing.id, transports: existing.transports }] : [],
    });

    // Store challenge temporarily (60s TTL)
    await db.collection("auth").doc("challenge").set({
      value: options.challenge,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(options);
  } catch (err) {
    console.error("register-challenge error:", err);
    return NextResponse.json({ error: "Failed to generate challenge" }, { status: 500 });
  }
}
