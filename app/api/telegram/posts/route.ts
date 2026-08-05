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
  imageUrl: string | null;
  hasVideo: boolean;
  mediaUrl: string | null;
}

// ── Server-side post cache ────────────────────────────────────────────────────
// Keyed by channel username. Entries expire after CACHE_TTL_MS.
// Stale entries are served immediately while a background refresh runs.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const BACKGROUND_REFRESH_MS = 4 * 60 * 1000; // refresh starts at 4 min
const POOL_SIZE = 30; // reduced from 50 — faster fetch, still plenty to shuffle

interface CacheEntry {
  posts: TelegramPost[];
  fetchedAt: number;
  refreshing: boolean;
}
const postCache = new Map<string, CacheEntry>();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchFromTelegram(channel: string): Promise<TelegramPost[]> {
  const client = await getTelegramClient();
  const messages = await client.getMessages(channel, { limit: POOL_SIZE });
  const posts: TelegramPost[] = [];

  for (const msg of messages) {
    if (!msg.message?.trim()) continue;

    let imageUrl: string | null = null;
    let hasVideo = false;
    let mediaUrl: string | null = null;

    if (msg.media) {
      try {
        if (msg.photo) {
          mediaUrl = `/api/telegram/media?channel=${encodeURIComponent(channel)}&msgId=${msg.id}&type=photo`;
          imageUrl = mediaUrl;
        } else if (msg.document) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mime: string = (msg.document as any).mimeType ?? "";
          if (mime.startsWith("video/")) {
            hasVideo = true;
            mediaUrl = `/api/telegram/media?channel=${encodeURIComponent(channel)}&msgId=${msg.id}`;
            try {
              const thumb = await client.downloadMedia(msg.media, { thumb: 1 }) as Buffer | undefined;
              if (thumb?.length) imageUrl = `data:image/jpeg;base64,${thumb.toString("base64")}`;
            } catch {
              try {
                const thumb = await client.downloadMedia(msg.media, { thumb: 0 }) as Buffer | undefined;
                if (thumb?.length) imageUrl = `data:image/jpeg;base64,${thumb.toString("base64")}`;
              } catch { /* no thumbnail */ }
            }
          } else if (mime.startsWith("image/")) {
            mediaUrl = `/api/telegram/media?channel=${encodeURIComponent(channel)}&msgId=${msg.id}`;
            imageUrl = mediaUrl;
          }
        }
      } catch { /* media download failed — still show text */ }
    }

    posts.push({ id: msg.id, text: msg.message, date: msg.date, views: msg.views ?? 0, channel, imageUrl, hasVideo, mediaUrl });
  }

  return posts;
}

// Warm or refresh a single channel's cache entry
async function warmCache(channel: string): Promise<void> {
  const entry = postCache.get(channel);
  if (entry?.refreshing) return; // already in flight

  if (entry) entry.refreshing = true;
  try {
    console.log(`[telegram/posts] warming cache for @${channel}`);
    const posts = await fetchFromTelegram(channel);
    postCache.set(channel, { posts, fetchedAt: Date.now(), refreshing: false });
    console.log(`[telegram/posts] cached ${posts.length} posts for @${channel}`);
  } catch (err) {
    console.error(`[telegram/posts] warmCache failed for @${channel}:`, err);
    if (entry) entry.refreshing = false;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const channel  = (searchParams.get("channel") ?? "").replace(/^@/, "");
  // initial=1 → return only first 10 posts for fast first render
  const initial  = searchParams.get("initial") === "1";
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  if (!process.env.TELEGRAM_SESSION || !process.env.TELEGRAM_API_ID) {
    return NextResponse.json({ error: "Telegram credentials not configured" }, { status: 500 });
  }
  if (!channel) {
    return NextResponse.json({ error: "Missing channel param" }, { status: 400 });
  }

  const entry = postCache.get(channel);
  const now   = Date.now();

  // ── Serve from cache if fresh enough ───────────────────────────────────────
  if (entry && now - entry.fetchedAt < CACHE_TTL_MS) {
    // Start background refresh when entry is getting stale (>4 min old)
    if (!entry.refreshing && now - entry.fetchedAt > BACKGROUND_REFRESH_MS) {
      warmCache(channel); // fire-and-forget
    }
    const slice = shuffle(entry.posts).slice(0, initial ? 10 : limit);
    console.log(`[telegram/posts] cache hit @${channel} → ${slice.length} posts`);
    return NextResponse.json({ posts: slice, channel, cached: true });
  }

  // ── Cache miss — fetch from Telegram ───────────────────────────────────────
  try {
    const posts = await fetchFromTelegram(channel);
    postCache.set(channel, { posts, fetchedAt: now, refreshing: false });
    const slice = shuffle(posts).slice(0, initial ? 10 : limit);
    return NextResponse.json({ posts: slice, channel, cached: false });
  } catch (err) {
    console.error("[telegram/posts]", err);
    // If we have a stale cache entry, serve it rather than failing
    if (entry) {
      const slice = shuffle(entry.posts).slice(0, initial ? 10 : limit);
      return NextResponse.json({ posts: slice, channel, cached: true, stale: true });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Prefetch endpoint — called by the client when the accordion opens.
// Warms all requested channels in parallel, responds immediately with 202.
export async function POST(req: NextRequest) {
  try {
    const { channels }: { channels: string[] } = await req.json();
    if (!Array.isArray(channels)) return NextResponse.json({ ok: false }, { status: 400 });

    const now = Date.now();
    for (const ch of channels) {
      const entry = postCache.get(ch);
      // Only warm if missing or older than 4 min
      if (!entry || now - entry.fetchedAt > BACKGROUND_REFRESH_MS) {
        warmCache(ch); // fire-and-forget — runs in background
      }
    }
    return NextResponse.json({ ok: true, queued: channels.length }, { status: 202 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
