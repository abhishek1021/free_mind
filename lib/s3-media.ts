import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

export const S3_BUCKET = process.env.S3_MEDIA_BUCKET ?? "";
export const CDN_URL   = (process.env.CDN_MEDIA_URL ?? "").replace(/\/$/, "");

export const s3 = S3_BUCKET
  ? new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" })
  : null;

export function mediaKey(channel: string, msgId: number, suffix = ""): string {
  return `telegram-media/${channel}/${msgId}${suffix}`;
}

export function cdnUrl(key: string): string {
  return `${CDN_URL}/${key}`;
}

export function isCdnUrl(url: string): boolean {
  return !!CDN_URL && url.startsWith(CDN_URL);
}

// Returns true if the object already exists in S3
export async function existsInS3(key: string): Promise<boolean> {
  if (!s3) return false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// Uploads a buffer to S3 and returns the CDN URL.
// Throws on failure — callers decide whether to swallow or propagate.
export async function uploadToS3(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<string> {
  if (!s3) throw new Error("S3 not configured");
  await s3.send(new PutObjectCommand({
    Bucket:       S3_BUCKET,
    Key:          key,
    Body:         body,
    ContentType:  contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return cdnUrl(key);
}
