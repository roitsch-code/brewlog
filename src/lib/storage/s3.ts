import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

declare global {
  // eslint-disable-next-line no-var
  var __brewlogS3Client: S3Client | undefined;
}

function createClient(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 env vars missing (S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)");
  }
  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
}

export function getS3Client(): S3Client {
  if (!global.__brewlogS3Client) {
    global.__brewlogS3Client = createClient();
  }
  return global.__brewlogS3Client;
}

export function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is not set");
  return bucket;
}

export function getPublicUrlPrefix(): string {
  const prefix = process.env.NEXT_PUBLIC_S3_PUBLIC_URL_PREFIX;
  if (!prefix) throw new Error("NEXT_PUBLIC_S3_PUBLIC_URL_PREFIX is not set");
  return prefix.replace(/\/$/, "");
}

export async function putObject(
  path: string,
  bytes: Buffer | Uint8Array,
  contentType: string
): Promise<{ url: string; path: string }> {
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: path,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return { url: `${getPublicUrlPrefix()}/${path}`, path };
}

export async function deleteObject(path: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: path })
  );
}
