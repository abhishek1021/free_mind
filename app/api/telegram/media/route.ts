import { NextRequest } from "next/server";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { withTelegramClient } from "@/lib/telegram-client";
import { Api } from "telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── S3 + CloudFront setup ─────────────────────────────────────────────────────
const S3_BUCKET = process.env.S3_MEDIA_BUCKET ?? "";
const CDN_URL   = (process.env.CDN_MEDIA_URL ?? "").replace(/\/$/, "");

const s3 = S3_BUCKET
  ? new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" })
  : null;

function mediaKey(channel: string, msgId: number): string {
  return `telegram-media/${channel}/${msgId}`;
}

// ── Debug trace ───────────────────────────────────────────────────────────────
// All debug info is returned as X-Debug-* response headers so it shows up
// in DevTools → Network → click the media request → Headers tab.
// No CloudWatch digging needed — everything visible in the browser.
interface Trace {
  s3Configured: boolean;
  cdnConfigured: boolean;
  s3Key: string;
  s3Check: string;       // hit | miss | error:<code> | skipped
  telegramFetch: string; // pending | success:<bytes> | error:<msg> | skipped
  s3Upload: string;      // success | error:<code>:<msg> | skipped
  path: string;          // cdn-redirect | s3-upload | direct-206 | direct-200 | error:<status>
  awsRegion: string;
}

function debugHeaders(t: Trace): Record<string, string> {
  return {
    "X-Debug-S3-Configured":  String(t.s3Configured),
    "X-Debug-CDN-Configured": String(t.cdnConfigured),
    "X-Debug-S3-Key":         t.s3Key,
    "X-Debug-S3-Check":       t.s3Check,
    "X-Debug-Telegram-Fetch": t.telegramFetch,
    "X-Debug-S3-Upload":      t.s3Upload,
    "X-Debug-Path":           t.path,
    "X-Debug-AWS-Region":     t.awsRegion,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const channel = (searchParams.get("channel") ?? "").replace(/^@/, "");
  const msgId   = parseInt(searchParams.get("msgId") ?? "0");

  if (!channel || !msgId) {
    return new Response("Missing params", { status: 400 });
  }

  const key = mediaKey(channel, msgId);

  const trace: Trace = {
    s3Configured:  !!s3,
    cdnConfigured: !!CDN_URL,
    s3Key:         key,
    s3Check:       "skipped",
    telegramFetch: "skipped",
    s3Upload:      "skipped",
    path:          "unknown",
    awsRegion:     process.env.AWS_REGION ?? "not-set(defaulting-to-us-east-1)",
  };

  // ── 1. S3 cache check ─────────────────────────────────────────────────────
  if (s3 && CDN_URL) {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      trace.s3Check = "hit";
      trace.path    = "cdn-redirect";
      console.log(`[media] CDN cache hit → redirect: ${key}`);
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${CDN_URL}/${key}`,
          ...debugHeaders(trace),
        },
      });
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e      = err as any;
      const status = e?.$metadata?.httpStatusCode ?? "unknown";
      const name   = e?.name ?? "UnknownError";

      if (status === 403) {
        trace.s3Check = `error:403-AccessDenied`;
        console.error(`[media] S3 HeadObject 403 AccessDenied — Lambda execution role does not have s3:GetObject on ${S3_BUCKET}. Bucket: ${S3_BUCKET}, Key: ${key}, Region: ${trace.awsRegion}`);
      } else if (status === 404) {
        trace.s3Check = "miss";
        console.log(`[media] S3 miss → fetching from Telegram: ${key}`);
      } else {
        trace.s3Check = `error:${status}-${name}`;
        console.warn(`[media] S3 HeadObject unexpected error: status=${status} name=${name} msg=${e?.message}`);
      }
    }
  } else {
    trace.s3Check = `skipped(s3=${!!s3},cdn=${!!CDN_URL},bucket="${S3_BUCKET}")`;
    console.warn(`[media] S3 not configured — s3=${!!s3} CDN_URL="${CDN_URL}" S3_BUCKET="${S3_BUCKET}"`);
  }

  // ── 2. Fetch from Telegram ────────────────────────────────────────────────
  try {
    return await withTelegramClient(async (client) => {
      trace.telegramFetch = "pending";
      const [msg] = await client.getMessages(channel, { ids: [msgId] });

      if (!msg?.media) {
        trace.telegramFetch = "error:no-media";
        trace.path = "error:404";
        return new Response("No media", { status: 404, headers: debugHeaders(trace) });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc      = msg.document as any;
      const mimeType = msg.photo
        ? "image/jpeg"
        : (doc?.mimeType ?? "application/octet-stream");
      const fileSize: number = doc?.size ?? 0;

      if (fileSize > 80 * 1024 * 1024) {
        trace.telegramFetch = `error:file-too-large(${fileSize}bytes)`;
        trace.path = "error:413";
        return new Response("File too large (>80 MB)", { status: 413, headers: debugHeaders(trace) });
      }

      // Build Telegram file location
      let fileLocation: Api.TypeInputFileLocation | null = null;

      if (msg.photo) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const photo = msg.photo as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sizes: any[] = photo.sizes ?? [];
        const thumbSize = sizes[sizes.length - 1]?.type ?? "s";
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
        trace.telegramFetch = "error:no-file-location";
        trace.path = "error:500";
        return new Response("Cannot locate file", { status: 500, headers: debugHeaders(trace) });
      }

      // Buffer the file
      const loc = fileLocation;
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

      trace.telegramFetch = `success:${totalBytes}bytes:${mimeType}`;
      console.log(`[media] Telegram fetch OK: ${key} ${totalBytes} bytes (${mimeType})`);

      // ── 3. Upload to S3 → redirect to CloudFront ──────────────────────────
      if (s3 && CDN_URL) {
        try {
          await s3.send(new PutObjectCommand({
            Bucket:       S3_BUCKET,
            Key:          key,
            Body:         body,
            ContentType:  mimeType,
            CacheControl: "public, max-age=31536000, immutable",
          }));
          trace.s3Upload = `success:${totalBytes}bytes`;
          trace.path     = "s3-upload-then-cdn-redirect";
          console.log(`[media] S3 upload OK → redirect to CDN: ${key}`);
          return new Response(null, {
            status: 302,
            headers: {
              "Location": `${CDN_URL}/${key}`,
              ...debugHeaders(trace),
            },
          });
        } catch (uploadErr) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e      = uploadErr as any;
          const status = e?.$metadata?.httpStatusCode ?? "unknown";
          const name   = e?.name ?? "UnknownError";
          trace.s3Upload = `error:${status}-${name}:${e?.message ?? ""}`;
          trace.path     = "error:503";
          console.error(`[media] S3 PutObject failed: status=${status} name=${name} bucket=${S3_BUCKET} key=${key} msg=${e?.message}`);
          return new Response(
            `S3 upload failed: ${name} (${status}) — ${e?.message}`,
            { status: 503, headers: debugHeaders(trace) }
          );
        }
      }

      // ── 4. Fallback: serve directly (local dev — S3 not configured) ───────
      trace.s3Upload = "skipped:s3-not-configured";
      const rangeHeader = req.headers.get("range");
      if (rangeHeader?.startsWith("bytes=")) {
        const [s, e] = rangeHeader.replace("bytes=", "").split("-");
        const start  = parseInt(s) || 0;
        const end    = e ? parseInt(e) : totalBytes - 1;
        const slice  = body.slice(start, end + 1);
        trace.path = "direct-206-fallback";
        return new Response(slice, {
          status: 206,
          headers: {
            "Content-Type":   mimeType,
            "Content-Range":  `bytes ${start}-${end}/${totalBytes}`,
            "Accept-Ranges":  "bytes",
            "Content-Length": String(slice.length),
            "Cache-Control":  "public, max-age=3600",
            ...debugHeaders(trace),
          },
        });
      }

      trace.path = "direct-200-fallback";
      return new Response(body, {
        headers: {
          "Content-Type":   mimeType,
          "Accept-Ranges":  "bytes",
          "Content-Length": String(totalBytes),
          "Cache-Control":  "public, max-age=3600",
          ...debugHeaders(trace),
        },
      });
    });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e      = err as any;
    const code   = e?.code;
    const errStr = String(err);

    if (code === 420 || errStr.includes("FLOOD")) {
      const seconds = e?.seconds ?? 60;
      trace.telegramFetch = `error:FLOOD_WAIT:${seconds}s`;
      trace.path = "error:429";
      console.warn(`[media] FLOOD_WAIT ${seconds}s for ${key}`);
      return new Response("Rate limited", {
        status: 429,
        headers: { "Retry-After": String(seconds), ...debugHeaders(trace) },
      });
    }

    trace.telegramFetch = `error:${errStr.slice(0, 120)}`;
    trace.path = "error:500";
    console.error(`[media] Telegram error for ${key}:`, err);
    return new Response("Error fetching media", {
      status: 500,
      headers: debugHeaders(trace),
    });
  }
}
