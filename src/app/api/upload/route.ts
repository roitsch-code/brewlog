import { NextRequest, NextResponse } from "next/server";
import { getAdminStorage } from "@/lib/firebase/admin";
import { getApps } from "firebase-admin/app";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const path = formData.get("path") as string | null;

    if (!file || !path) {
      return NextResponse.json({ error: "Missing file or path" }, { status: 400 });
    }

    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const fileRef = bucket.file(path);

    const bytes = await file.arrayBuffer();
    await fileRef.save(Buffer.from(bytes), {
      metadata: { contentType: file.type },
    });

    // Generate a Firebase Storage download token and patch it onto the file metadata.
    // This gives a permanent firebasestorage.googleapis.com URL (no expiry, no complex signing).
    const downloadToken = randomUUID();
    const bucketName = bucket.name;
    const encodedPath = encodeURIComponent(path);

    const app = getApps()[0];
    const { access_token } = await app.options.credential!.getAccessToken();

    await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ metadata: { firebaseStorageDownloadTokens: downloadToken } }),
      }
    );

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return NextResponse.json({ url, storagePath: path });
  } catch (err) {
    console.error("upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
