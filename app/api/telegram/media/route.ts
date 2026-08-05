import { NextRequest } from "next/server";
import { getTelegramClient } from "@/lib/telegram-client";
import { Api } from "telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const channel = (searchParams.get("channel") ?? "").replace(/^@/, "");
  const msgId   = parseInt(searchParams.get("msgId") ?? "0");

  if (!channel || !msgId) {
    return new Response("Missing params", { status: 400 });
  }

  try {
    const client = await getTelegramClient();
    const [msg]  = await client.getMessages(channel, { ids: [msgId] });

    if (!msg?.media) {
      return new Response("No media", { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc      = msg.document as any;
    const mimeType = msg.photo ? "image/jpeg" : (doc?.mimeType ?? "application/octet-stream");
    const fileSize: number = doc?.size ?? 0;

    if (fileSize > 80 * 1024 * 1024) {
      return new Response("File too large (>80 MB)", { status: 413 });
    }

    // Build file location
    let fileLocation: Api.TypeInputFileLocation | null = null;

    if (msg.photo) {
      const photo = msg.photo as any;
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
      return new Response("Cannot locate file", { status: 500 });
    }

    // ── Buffer the entire file ────────────────────────────────────────────────
    // Required for:
    //   • Range request support (iOS Safari mandates this for <video> playback)
    //   • Stable Content-Length header (chunked encoding breaks mobile video)
    // Photos are small (<1 MB). Videos are typically 5–30 MB on Telegram channels.
    const loc = fileLocation;
    const chunks: Uint8Array[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const chunk of (client as any).iterDownload({ file: loc, requestSize: 512 * 1024 })) {
      chunks.push(new Uint8Array(chunk as Buffer));
    }
    const totalBytes = chunks.reduce((n, c) => n + c.length, 0);
    const body = new Uint8Array(totalBytes);
    let off = 0;
    for (const c of chunks) { body.set(c, off); off += c.length; }

    // ── Range request handling (required for iOS Safari / PWA video) ──────────
    const rangeHeader = req.headers.get("range");
    if (rangeHeader?.startsWith("bytes=")) {
      const [s, e] = rangeHeader.replace("bytes=", "").split("-");
      const start  = parseInt(s)  || 0;
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

    // ── Full response ─────────────────────────────────────────────────────────
    return new Response(body, {
      headers: {
        "Content-Type":   mimeType,
        "Accept-Ranges":  "bytes",
        "Content-Length": String(totalBytes),
        "Cache-Control":  "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[telegram/media]", err);
    return new Response("Error fetching media", { status: 500 });
  }
}
