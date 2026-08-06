import { NextRequest } from "next/server";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { withTelegramClient } from "@/lib/telegram-client";
import { Api } from "telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── S3 + CloudFront setup ─────────────────────────────────────────────────────
const S3_BUCKET = process.env.S3_MEDIA_BUCKET ?? "";
const CDN_URL   = (process.env.CDN_MEDIA_URL ?? "").replace(/\/$/, "");

// S3 client is only instantiated when the bucket env var is present.
// On Amplify/Lambda the execution role supplies credentials automatically —
// no access key or secret key needed in env vars.
const s3 = S3_BUCKET
  ? new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" })
  : null;

function mediaKey(channel: string, msgId: number): string {
  return `telegram-media/${channel}/${msgId}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const channel = (searchParams.get("channel") ?? "").replace(/^@/, "");
  const msgId   = parseInt(searchParams.get("msgId") ?? "0");

  if (!channel || !msgId) {
    return new Response("Missing params", { status: 400 });
  }

  const key = mediaKey(channel, msgId);

  // ── 1. Check S3 cache ───────────────────────────────────────────────────────
  // HeadObject uses s3:GetObject IAM permission (AWS maps it internally).
  // A 302 redirect to CloudFront means the client fetches bytes from the CDN
  // edge — zero Lambda bandwidth, no Telegram call, no FLOOD_WAIT risk.
  if (s3 && CDN_URL) {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      console.log(`[media] CDN cache hit: ${key}`);
      return Response.redirect(`${CDN_URL}/${key}`, 302);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (err as any)?.$metadata?.httpStatusCode;
      if (status !== 404 && status !== 403) {
        console.warn("[media] S3 HeadObject unexpected error:", err);
      }
      // 404 = not cached yet → fall through to Telegram fetch
    }
  }

  // ── 2. Fetch from Telegram (first-time only) ────────────────────────────────
  try {
    return await withTelegramClient(async (client) => {
      const [msg] = await client.getMessages(channel, { ids: [msgId] });

      if (!msg?.media) {
        return new Response("No media", { status: 404 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc      = msg.document as any;
      const mimeType = msg.photo
        ? "image/jpeg"
        : (doc?.mimeType ?? "application/octet-stream");
      const fileSize: number = doc?.size ?? 0;

      if (fileSize > 80 * 1024 * 1024) {
        return new Response("File too large (>80 MB)", { status: 413 });
      }

      // Build Telegram file location
      let fileLocation: Api.TypeInputFileLocation | null = null;

      if (msg.photo) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const photo  = msg.photo as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sizes: any[] = photo.sizes ?? [];
        const thumbSize    = sizes[sizes.length - 1]?.type ?? "s";
        fileLocation = new Api.InputPhotoFileLocation({
          id: photo.id,
          accessHash: photo.accessHash,
          fileReference: photo.fileReference,
          thumbSize,
        });
      } else if (msg.document) {
        fileLocation = new Api.InputDocumentFileLocation({
          id: doc.id,
          accessHash: doc.accessHash,
          fileReference: doc.fileReference,
          thumbSize: "",
        });
      }

      if (!fileLocation) {
        return new Response("Cannot locate file", { status: 500 });
      }

      // Buffer the entire file from Telegram
      const loc    = fileLocation;
      const chunks: Uint8Array[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const chunk of (client as any).iterDownload({
        file: loc,
        requestSize: 512 * 1024,
      })) {
        chunks.push(new Uint8Array(chunk as Buffer));
      }
      const totalBytes = chunks.reduce((n, c) => n + c.length, 0);
      const body = new Uint8Array(totalBytes);
      let off = 0;
      for (const c of chunks) { body.set(c, off); off += c.length; }

      // ── 3. Upload to S3, then redirect to CloudFront ──────────────────────
      // After this point every future request for this media goes direct to CDN —
      // no Lambda, no Telegram, no FLOOD_WAIT — forever.
      if (s3 && CDN_URL) {
        try {
          await s3.send(new PutObjectCommand({
            Bucket:       S3_BUCKET,
            Key:          key,
            Body:         body,
            ContentType:  mimeType,
            CacheControl: "public, max-age=31536000, immutable",
          }));
          console.log(`[media] uploaded to S3: ${key} (${totalBytes} bytes)`);
          return Response.redirect(`${CDN_URL}/${key}`, 302);
        } catch (uploadErr) {
          console.error("[media] S3 upload failed — serving directly:", uploadErr);
          // Fall through to serve directly if S3 is unavailable
        }
      }

      // ── 4. Fallback: serve directly (local dev or S3 unavailable) ────────
      // CloudFront/S3 handles range requests natively when the redirect works.
      // This fallback supports range requests for iOS Safari video playback.
      const rangeHeader = req.headers.get("range");
      if (rangeHeader?.startsWith("bytes=")) {
        const [s, e] = rangeHeader.replace("bytes=", "").split("-");
        const start  = parseInt(s) || 0;
        const end    = e ? parseInt(e) : totalBytes - 1;
        const slice  = body.slice(start, end + 1);
        return new Response(slice, {
          status: 206,
          headers: {
            "Content-Type":   mimeType,
            "Content-Range":  `bytes ${start}-${end}/${totalBytes}`,
            "Accept-Ranges":  "bytes",
            "Content-Length": String(slice.length),
            "Cache-Control":  "public, max-age=3600",
          },
        });
      }

      return new Response(body, {
        headers: {
          "Content-Type":   mimeType,
          "Accept-Ranges":  "bytes",
          "Content-Length": String(totalBytes),
          "Cache-Control":  "public, max-age=3600",
        },
      });
    });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = (err as any)?.code;
    const errStr = String(err);
    if (code === 420 || errStr.includes("FLOOD")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seconds = (err as any)?.seconds ?? 60;
      console.warn(`[media] FLOOD_WAIT ${seconds}s`);
      return new Response("Rate limited", {
        status: 429,
        headers: { "Retry-After": String(seconds) },
      });
    }
    console.error("[media]", err);
    return new Response("Error fetching media", { status: 500 });
  }
}
