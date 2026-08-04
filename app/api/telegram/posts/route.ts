import { NextRequest, NextResponse } from "next/server";
import { getTelegramClient } from "@/lib/telegram-client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export interface TelegramPost {
  id: number;
  text: string;
  date: number;
  views: number;
  channel: string;
  imageUrl: string | null;  // proxy URL for photos, or base64 placeholder
  hasVideo: boolean;
  mediaUrl: string | null;  // URL to /api/telegram/media for videos (and photos)
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const channel = (searchParams.get("channel") ?? "").replace(/^@/, "");
  const limit   = Math.min(parseInt(searchParams.get("limit") ?? "15"), 25);

  if (!process.env.TELEGRAM_SESSION || !process.env.TELEGRAM_API_ID) {
    return NextResponse.json({ error: "Telegram credentials not configured" }, { status: 500 });
  }
  if (!channel) {
    return NextResponse.json({ error: "Missing channel param" }, { status: 400 });
  }

  try {
    const client = await getTelegramClient();
    const messages = await client.getMessages(channel, { limit });

    const posts: TelegramPost[] = [];

    for (const msg of messages) {
      if (!msg.message?.trim()) continue;

      let imageUrl: string | null = null;
      let hasVideo = false;
      let mediaUrl: string | null = null;

      if (msg.media) {
        try {
          if (msg.photo) {
            // Use media proxy for full-quality photo — no blurry base64 thumbnail
            mediaUrl = `/api/telegram/media?channel=${encodeURIComponent(channel)}&msgId=${msg.id}&type=photo`;
            imageUrl = mediaUrl;
          } else if (msg.document) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mime: string = (msg.document as any).mimeType ?? "";
            if (mime.startsWith("video/")) {
              hasVideo = true;
              mediaUrl = `/api/telegram/media?channel=${encodeURIComponent(channel)}&msgId=${msg.id}`;
              // Download a slightly larger thumbnail for the video poster (thumb 1 > thumb 0)
              try {
                const thumb = await client.downloadMedia(msg.media, { thumb: 1 }) as Buffer | undefined;
                if (thumb?.length) {
                  imageUrl = `data:image/jpeg;base64,${thumb.toString("base64")}`;
                }
              } catch {
                try {
                  const thumb = await client.downloadMedia(msg.media, { thumb: 0 }) as Buffer | undefined;
                  if (thumb?.length) imageUrl = `data:image/jpeg;base64,${thumb.toString("base64")}`;
                } catch { /* no thumbnail */ }
              }
            } else if (mime.startsWith("image/")) {
              // Route image documents through proxy too
              mediaUrl = `/api/telegram/media?channel=${encodeURIComponent(channel)}&msgId=${msg.id}`;
              imageUrl = mediaUrl;
            }
          }
        } catch { /* media download failed — still show text */ }
      }

      posts.push({
        id: msg.id,
        text: msg.message,
        date: msg.date,
        views: msg.views ?? 0,
        channel,
        imageUrl,
        hasVideo,
        mediaUrl,
      });
    }

    return NextResponse.json({ posts, channel });
  } catch (err) {
    console.error("[telegram/posts]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
