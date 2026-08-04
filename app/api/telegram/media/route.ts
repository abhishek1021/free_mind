import { NextRequest } from "next/server";
import { getTelegramClient } from "@/lib/telegram-client";
import { Api } from "telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
    const doc  = msg.document as any;
    const mimeType: string = msg.photo ? "image/jpeg" : (doc?.mimeType ?? "application/octet-stream");
    const fileSize: number = doc?.size ?? 0;

    if (fileSize > 80 * 1024 * 1024) {
      return new Response("Video too large to stream (>80 MB)", { status: 413 });
    }

    // Build the low-level file location for streaming
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

    // Stream chunks to the browser as they arrive — video starts playing immediately
    const loc = fileLocation;
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for await (const chunk of (client as any).iterDownload({
            file: loc,
            requestSize: 512 * 1024, // 512 KB per request
          })) {
            controller.enqueue(new Uint8Array(chunk as Buffer));
          }
          controller.close();
        } catch (err) {
          console.error("[media stream]", err);
          controller.error(err);
        }
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=3600",
      "Transfer-Encoding": "chunked",
    };
    if (fileSize > 0) headers["Content-Length"] = String(fileSize);

    return new Response(readable, { headers });
  } catch (err) {
    console.error("[telegram/media]", err);
    return new Response("Error fetching media", { status: 500 });
  }
}
