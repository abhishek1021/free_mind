import { NextRequest, NextResponse } from "next/server";
import { withTelegramClient } from "@/lib/telegram-client";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

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
const CACHE_TTL_MS         = 5 * 60 * 1000;
const BACKGROUND_REFRESH_MS = 4 * 60 * 1000;
// Maximum posts to fetch for channel-tab view; feed calls pass smaller limits
const MAX_POOL_SIZE = 20;

interface CacheEntry { posts: TelegramPost[]; fetchedAt: number; refreshing: boolean; }
const postCache = new Map<string, CacheEntry>();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// limit controls both how many messages are fetched and how many thumbnails are
// downloaded. Keeping it small (e.g. 5 for feed) prevents exhausting the
// auth.ExportAuthorization rate limit (Telegram error 420 FLOOD_WAIT).
async function fetchFromTelegram(channel: string, limit: number): Promise<TelegramPost[]> {
  return withTelegramClient(async (client) => {
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
            // Keep mediaUrl for full-size (long-press modal only)
            mediaUrl = `/api/telegram/media?channel=${encodeURIComponent(channel)}&msgId=${msg.id}&type=photo`;
            // Download a small thumbnail inline — avoids 20 separate media proxy
            // connections firing simultaneously when posts render on screen.
            try {
              const thumb = await client.downloadMedia(msg.media, { thumb: 1 }) as Buffer | undefined;
              if (thumb?.length) {
                imageUrl = `data:image/jpeg;base64,${thumb.toString("base64")}`;
              } else {
                const thumb0 = await client.downloadMedia(msg.media, { thumb: 0 }) as Buffer | undefined;
                imageUrl = thumb0?.length ? `data:image/jpeg;base64,${thumb0.toString("base64")}` : null;
              }
            } catch (thumbErr) {
              // FLOOD_WAIT on auth.ExportAuthorization: file is on another DC and
              // Telegram rate-limited the cross-DC auth. Skip thumbnail — don't fall
              // back to mediaUrl which would cause another cross-DC request on render.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if ((thumbErr as any)?.code === 420 || String(thumbErr).includes("FLOOD")) {
                console.warn(`[telegram/posts] FLOOD_WAIT during thumbnail for msg ${msg.id} — skipping`);
              }
              imageUrl = null;
            }
          } else if (msg.document) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mime: string = (msg.document as any).mimeType ?? "";
            if (mime.startsWith("video/")) {
              hasVideo = true;
              mediaUrl = `/api/telegram/media?channel=${encodeURIComponent(channel)}&msgId=${msg.id}`;
              try {
                const thumb = await client.downloadMedia(msg.media, { thumb: 1 }) as Buffer | undefined;
                if (thumb?.length) imageUrl = `data:image/jpeg;base64,${thumb.toString("base64")}`;
              } catch (thumbErr) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((thumbErr as any)?.code === 420 || String(thumbErr).includes("FLOOD")) {
                  console.warn(`[telegram/posts] FLOOD_WAIT during video thumb for msg ${msg.id} — skipping`);
                } else {
                  try {
                    const thumb = await client.downloadMedia(msg.media, { thumb: 0 }) as Buffer | undefined;
                    if (thumb?.length) imageUrl = `data:image/jpeg;base64,${thumb.toString("base64")}`;
                  } catch { /* no thumbnail */ }
                }
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
  });
}

// Warm or refresh a single channel's cache entry.
// Uses a small limit (5) to minimise auth.ExportAuthorization calls —
// the channel tab will trigger a larger fetch when the user opens it.
async function warmCache(channel: string): Promise<void> {
  const entry = postCache.get(channel);
  if (entry?.refreshing) return; // already in flight

  if (entry) entry.refreshing = true;
  try {
    console.log(`[telegram/posts] warming cache for @${channel}`);
    const posts = await fetchFromTelegram(channel, 5);
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
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "20"), MAX_POOL_SIZE);

  if (!process.env.TELEGRAM_SESSION || !process.env.TELEGRAM_API_ID) {
    return NextResponse.json({ error: "Telegram credentials not configured" }, { status: 500 });
  }
  if (!channel) {
    return NextResponse.json({ error: "Missing channel param" }, { status: 400 });
  }

  const entry = postCache.get(channel);
  const now   = Date.now();

  // ── Serve from cache if fresh and has enough posts ──────────────────────────
  if (entry && now - entry.fetchedAt < CACHE_TTL_MS) {
    const want = initial ? Math.min(limit, 10) : limit;
    if (entry.posts.length >= want) {
      // Trigger background refresh when stale or cache has fewer posts than max
      if (!entry.refreshing && (
        now - entry.fetchedAt > BACKGROUND_REFRESH_MS ||
        entry.posts.length < limit
      )) {
        // Background-fetch with the full requested limit to top up cache
        ;(async () => {
          const entry2 = postCache.get(channel);
          if (entry2?.refreshing) return;
          if (entry2) entry2.refreshing = true;
          try {
            const posts = await fetchFromTelegram(channel, limit);
            postCache.set(channel, { posts, fetchedAt: Date.now(), refreshing: false });
          } catch { if (entry2) entry2.refreshing = false; }
        })();
      }
      const slice = shuffle(entry.posts).slice(0, want);
      console.log(`[telegram/posts] cache hit @${channel} → ${slice.length} posts`);
      return NextResponse.json({ posts: slice, channel, cached: true });
    }
    // Cache exists but has fewer posts than requested — fall through to re-fetch
  }

  // ── Cache miss or insufficient posts — fetch from Telegram ─────────────────
  try {
    const posts = await fetchFromTelegram(channel, limit);
    // Merge with any existing cached posts so we don't lose previously fetched ones
    const existing = entry?.posts ?? [];
    const seenIds  = new Set(posts.map((p) => p.id));
    const merged   = [...posts, ...existing.filter((p) => !seenIds.has(p.id))];
    postCache.set(channel, { posts: merged, fetchedAt: now, refreshing: false });
    const want = initial ? Math.min(limit, 10) : limit;
    const slice = shuffle(posts).slice(0, want);
    return NextResponse.json({ posts: slice, channel, cached: false });
  } catch (err) {
    console.error("[telegram/posts]", err);
    // Serve stale cache rather than failing
    if (entry) {
      const want = initial ? Math.min(limit, 10) : limit;
      const slice = shuffle(entry.posts).slice(0, want);
      return NextResponse.json({ posts: slice, channel, cached: true, stale: true });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Prefetch endpoint — called by the client when the user lands on the channels tab.
// Warms channels one-at-a-time (staggered) to avoid multiple simultaneous Telegram
// connections from different Lambda instances triggering AUTH_KEY_DUPLICATED.
export async function POST(req: NextRequest) {
  try {
    const { channels }: { channels: string[] } = await req.json();
    if (!Array.isArray(channels)) return NextResponse.json({ ok: false }, { status: 400 });

    const now  = Date.now();
    const todo = channels.filter((ch) => {
      const entry = postCache.get(ch);
      return !entry || now - entry.fetchedAt > BACKGROUND_REFRESH_MS;
    });

    // Stagger warmups: one every 800ms so only one Telegram connection is active at a time
    ;(async () => {
      for (const ch of todo) {
        await warmCache(ch);                              // sequential — not parallel
        await new Promise(r => setTimeout(r, 800));      // breathe between channels
      }
    })();

    // Respond immediately — warming runs in the background
    return NextResponse.json({ ok: true, queued: todo.length }, { status: 202 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
