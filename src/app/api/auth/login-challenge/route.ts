import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getAdminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const db = getAdminDb();

    // Load stored credential
    const credSnap = await db.collection("auth").doc("credential").get();
    const credential = credSnap.exists ? credSnap.data() : null;

    const options = await generateAuthenticationOptions({
      rpID: process.env.WEBAUTHN_RP_ID || "localhost",
      userVerification: "required",
      allowCredentials: credential?.id ? [{ id: credential.id, transports: credential.transports }] : [],
    });

    // Store challenge temporarily
    await db.collection("auth").doc("challenge").set({
      value: options.challenge,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(options);
  } catch (err) {
    console.error("login-challenge error:", err);
    return NextResponse.json({ error: "Failed to generate challenge" }, { status: 500 });
  }
}
