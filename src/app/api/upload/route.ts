import { NextRequest, NextResponse } from "next/server";
import { putObject } from "@/lib/storage/s3";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const path = formData.get("path") as string | null;

    if (!file || !path) {
      return NextResponse.json({ error: "Missing file or path" }, { status: 400 });
    }

    const ALLOWED_PREFIXES = ["bags/", "uploads/"];
    if (path.includes("..") || path.startsWith("/") || !ALLOWED_PREFIXES.some(p => path.startsWith(p))) {
      return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
    }

    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const { url } = await putObject(path, bytes, file.type);

    return NextResponse.json({ url, storagePath: path });
  } catch (err) {
    console.error("upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
