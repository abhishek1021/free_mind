import { NextRequest, NextResponse } from "next/server";
import { withTelegramClient } from "@/lib/telegram-client";
import { Api } from "telegram";
import { s3, mediaKey, cdnUrl, existsInS3, uploadToS3 } from "@/lib/s3-media";

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

// ── Background video upload ───────────────────────────────────────────────────
// After fetchFromTelegram returns proxy URLs for new videos, we fire-and-forget
// a full video download + S3 upload. On the next cache refresh, existsInS3()
// returns true and the post gets a CDN mediaUrl, enabling autoplay.
const videoUploadInFlight = new Set<string>();

function updateCacheMediaUrl(channel: string, msgId: number, url: string): void {
  const entry = postCache.get(channel);
  if (!entry) return;
  for (const post of entry.posts) {
    if (post.id === msgId && post.hasVideo) post.mediaUrl = url;
  }
}

function scheduleVideoUpload(channel: string, msgId: number): void {
  if (!s3) return;
  const key = mediaKey(channel, msgId);
  if (videoUploadInFlight.has(key)) return;
  videoUploadInFlight.add(key);

  ;(async () => {
    try {
      if (await existsInS3(key)) {
        updateCacheMediaUrl(channel, msgId, cdnUrl(key));
        return;
      }
      await withTelegramClient(async (client) => {
        const [msg] = await client.getMessages(channel, { ids: [msgId] });
        if (!msg?.document) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = msg.document as any;
        if (!doc.mimeType?.startsWith("video/")) return;
        const fileSize: number = doc.size ?? 0;
        if (fileSize > 80 * 1024 * 1024) {
          console.warn(`[telegram/posts] bg-upload: video too large (${fileSize}b) — skipping ${key}`);
          return;
        }
        const fileLocation = new Api.InputDocumentFileLocation({
          id: doc.id,
          accessHash: doc.accessHash,
          fileReference: doc.fileReference,
          thumbSize: "",
        });
        const chunks: Uint8Array[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const chunk of (client as any).iterDownload({
          file: fileLocation,
          requestSize: 512 * 1024,
        })) {
          chunks.push(new Uint8Array(chunk as Buffer));
        }
        const totalBytes = chunks.reduce((n, c) => n + c.length, 0);
        const body = new Uint8Array(totalBytes);
        let off = 0;
        for (const c of chunks) { body.set(c, off); off += c.length; }
        await uploadToS3(key, body, doc.mimeType);
        console.log(`[telegram/posts] bg-upload done: ${key} (${totalBytes}b)`);
        updateCacheMediaUrl(channel, msgId, cdnUrl(key));
      });
    } catch (err) {
      console.warn(`[telegram/posts] bg-upload failed for ${key}:`, err);
    } finally {
      videoUploadInFlight.delete(key);
    }
  })();
}

// ── Helper: upload thumbnail to S3, return CDN URL; fallback to base64 ───────
async function getThumbnail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  media: any,
  thumbKey: string,
): Promise<string | null> {
  if (s3) {
    // S3 configured → check cache or upload
    try {
      if (await existsInS3(thumbKey)) return cdnUrl(thumbKey);
      const thumb = await client.downloadMedia(media, { thumb: 1 }) as Buffer | undefined;
      if (thumb?.length) return await uploadToS3(thumbKey, thumb, "image/jpeg");
      const thumb0 = await client.downloadMedia(media, { thumb: 0 }) as Buffer | undefined;
      if (thumb0?.length) return await uploadToS3(thumbKey, thumb0, "image/jpeg");
      return null;
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === 420 || String(err).includes("FLOOD")) {
        console.warn(`[telegram/posts] FLOOD_WAIT during thumbnail upload — skipping`);
      } else {
        console.warn(`[telegram/posts] thumbnail S3 error:`, err);
      }
      return null;
    }
  } else {
    // No S3 → inline base64 fallback
    try {
      const thumb = await client.downloadMedia(media, { thumb: 1 }) as Buffer | undefined;
      if (thumb?.length) return `data:image/jpeg;base64,${thumb.toString("base64")}`;
      const thumb0 = await client.downloadMedia(media, { thumb: 0 }) as Buffer | undefined;
      if (thumb0?.length) return `data:image/jpeg;base64,${thumb0.toString("base64")}`;
      return null;
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === 420 || String(err).includes("FLOOD")) {
        console.warn(`[telegram/posts] FLOOD_WAIT during thumbnail download — skipping`);
      }
      return null;
    }
  }
}

// limit controls both how many messages are fetched and how many thumbnails are
// downloaded. Keeping it small (e.g. 5 for feed) prevents exhausting the
// auth.ExportAuthorization rate limit (Telegram error 420 FLOOD_WAIT).
// offsetDate is a Unix timestamp (seconds); Telegram returns messages OLDER
// than this date, giving historical variety on each feed refresh.
async function fetchFromTelegram(channel: string, limit: number, offsetDate?: number): Promise<TelegramPost[]> {
  return withTelegramClient(async (client) => {
    const msgOpts: Record<string, unknown> = { limit };
    if (offsetDate) msgOpts.offsetDate = offsetDate;
    const messages = await client.getMessages(channel, msgOpts);
    const posts: TelegramPost[] = [];

    for (const msg of messages) {
      if (!msg.message?.trim()) continue;

      let imageUrl: string | null = null;
      let hasVideo = false;
      let mediaUrl: string | null = null;

      if (msg.media) {
        try {
          if (msg.photo) {
            // Full photo served via proxy (handles S3 → CDN redirect automatically)
            mediaUrl = `/api/telegram/media?channel=${encodeURIComponent(channel)}&msgId=${msg.id}&type=photo`;
            imageUrl = await getThumbnail(client, msg.media, mediaKey(channel, msg.id, "-thumb"));
          } else if (msg.document) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mime: string = (msg.document as any).mimeType ?? "";
            if (mime.startsWith("video/")) {
              hasVideo = true;
              const videoKey = mediaKey(channel, msg.id);
              // If video already in S3 → CDN URL enables autoplay in Feed.tsx
              if (s3 && await existsInS3(videoKey)) {
                mediaUrl = cdnUrl(videoKey);
              } else {
                // Not yet in S3 → proxy URL; schedule background upload
                mediaUrl = `/api/telegram/media?channel=${encodeURIComponent(channel)}&msgId=${msg.id}`;
                scheduleVideoUpload(channel, msg.id);
              }
              imageUrl = await getThumbnail(client, msg.media, mediaKey(channel, msg.id, "-thumb"));
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
async function warmCache(channel: string): Promise<void> {
  const entry = postCache.get(channel);
  if (entry?.refreshing) return;

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
  const channel    = (searchParams.get("channel") ?? "").replace(/^@/, "");
  const initial    = searchParams.get("initial") === "1";
  const limit      = Math.min(parseInt(searchParams.get("limit") ?? "20"), MAX_POOL_SIZE);
  // offsetDate: Unix timestamp (seconds). When provided, Telegram returns
  // messages older than this date, giving variety across refreshes.
  // Cache is bypassed for these requests — they are intentionally non-latest.
  const offsetDate = searchParams.get("offsetDate") ? parseInt(searchParams.get("offsetDate")!) : undefined;

  if (!process.env.TELEGRAM_SESSION || !process.env.TELEGRAM_API_ID) {
    return NextResponse.json({ error: "Telegram credentials not configured" }, { status: 500 });
  }
  if (!channel) {
    return NextResponse.json({ error: "Missing channel param" }, { status: 400 });
  }

  // ── Time-offset request: bypass cache, fetch historical posts directly ──────
  if (offsetDate) {
    try {
      let posts = await fetchFromTelegram(channel, limit, offsetDate);
      // If no posts found at that timestamp (sparse channel), fall back to latest
      if (posts.length === 0) {
        posts = await fetchFromTelegram(channel, limit);
      }
      const slice = shuffle(posts).slice(0, limit);
      return NextResponse.json({ posts: slice, channel, cached: false, offsetDate });
    } catch (err) {
      console.error("[telegram/posts] offsetDate fetch failed:", err);
      // On error, fall through to normal cache path below
    }
  }

  const entry = postCache.get(channel);
  const now   = Date.now();

  // ── Serve from cache if fresh and has enough posts ──────────────────────────
  if (entry && now - entry.fetchedAt < CACHE_TTL_MS) {
    const want = initial ? Math.min(limit, 10) : limit;
    if (entry.posts.length >= want) {
      if (!entry.refreshing && (
        now - entry.fetchedAt > BACKGROUND_REFRESH_MS ||
        entry.posts.length < limit
      )) {
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

      // Upgrade any proxy video URLs to CDN if the video is now in S3.
      // Runs in parallel — adds ~10ms but enables autoplay for uploaded videos.
      // slice elements share object references with entry.posts, so mutating
      // post.mediaUrl here also updates the cache for subsequent requests.
      if (s3) {
        const proxyVideos = slice.filter(p => p.hasVideo && p.mediaUrl?.startsWith("/api/"));
        if (proxyVideos.length > 0) {
          await Promise.all(proxyVideos.map(async (post) => {
            try {
              const key = mediaKey(channel, post.id);
              if (await existsInS3(key)) post.mediaUrl = cdnUrl(key);
            } catch { /* ignore — don't break cache serve on S3 error */ }
          }));
        }
      }

      console.log(`[telegram/posts] cache hit @${channel} → ${slice.length} posts`);
      return NextResponse.json({ posts: slice, channel, cached: true });
    }
  }

  // ── Cache miss or insufficient posts — fetch from Telegram ─────────────────
  try {
    const posts = await fetchFromTelegram(channel, limit);
    const existing = entry?.posts ?? [];
    const seenIds  = new Set(posts.map((p) => p.id));
    const merged   = [...posts, ...existing.filter((p) => !seenIds.has(p.id))];
    postCache.set(channel, { posts: merged, fetchedAt: now, refreshing: false });
    const want = initial ? Math.min(limit, 10) : limit;
    const slice = shuffle(posts).slice(0, want);
    return NextResponse.json({ posts: slice, channel, cached: false });
  } catch (err) {
    console.error("[telegram/posts]", err);
    if (entry) {
      const want = initial ? Math.min(limit, 10) : limit;
      const slice = shuffle(entry.posts).slice(0, want);
      if (s3) {
        const proxyVideos = slice.filter(p => p.hasVideo && p.mediaUrl?.startsWith("/api/"));
        if (proxyVideos.length > 0) {
          await Promise.all(proxyVideos.map(async (post) => {
            try {
              const key = mediaKey(channel, post.id);
              if (await existsInS3(key)) post.mediaUrl = cdnUrl(key);
            } catch { /* ignore */ }
          }));
        }
      }
      return NextResponse.json({ posts: slice, channel, cached: true, stale: true });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Prefetch endpoint — warms channels one-at-a-time to avoid concurrent Telegram
// connections from different Lambda instances.
export async function POST(req: NextRequest) {
  try {
    const { channels }: { channels: string[] } = await req.json();
    if (!Array.isArray(channels)) return NextResponse.json({ ok: false }, { status: 400 });

    const now  = Date.now();
    const todo = channels.filter((ch) => {
      const entry = postCache.get(ch);
      return !entry || now - entry.fetchedAt > BACKGROUND_REFRESH_MS;
    });

    ;(async () => {
      for (const ch of todo) {
        await warmCache(ch);
        await new Promise(r => setTimeout(r, 800));
      }
    })();

    return NextResponse.json({ ok: true, queued: todo.length }, { status: 202 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
