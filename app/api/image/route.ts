import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ── Server-side in-memory cache ───────────────────────────────────────────────
// Persists for the lifetime of the server instance.
// Key: "topic::category" → image URL (empty string = confirmed no image)
const cache = new Map<string, string>();

// ── Per-category search hints ─────────────────────────────────────────────────
const WIKI_HINTS: Record<string, string> = {
  "Mythology":     "Hindu mythology deity",
  "Science":       "science",
  "History":       "history",
  "Life Hacks":    "productivity self improvement",
  "Psychology":    "psychology",
  "World Facts":   "geography nature",
  "Philosophy":    "philosophy",
  "Riddles":       "puzzle",
  "Short Stories": "literature story",
  "Moral Stories": "folklore fable",
};

// Pexels search terms — tuned per category so results are visually rich
const PEXELS_HINTS: Record<string, string> = {
  "Mythology":     "indian temple god statue",
  "Science":       "science laboratory technology",
  "History":       "ancient history architecture",
  "Life Hacks":    "productivity lifestyle minimal",
  "Psychology":    "human mind psychology",
  "World Facts":   "nature world landscape",
  "Philosophy":    "philosophy wisdom meditation",
  "Riddles":       "puzzle mystery brain",
  "Short Stories": "book reading story",
  "Moral Stories": "nature peaceful wisdom",
};

// Wikipedia requires a descriptive User-Agent — without it requests are rejected
const WIKI_UA = "FreeMindApp/1.0 (educational PWA; contact: freemind@example.com)";

// ── Wikipedia ─────────────────────────────────────────────────────────────────

async function wikiPageImage(title: string, size = 500): Promise<string> {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=pageimages&format=json&pithumbsize=${size}&pilicense=any`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": WIKI_UA } });
    if (!res.ok) {
      console.warn(`[image/wiki] ${title} → HTTP ${res.status}`);
      return "";
    }
    const data = await res.json();
    const pages: Record<string, { thumbnail?: { source: string } }> =
      data?.query?.pages ?? {};
    for (const page of Object.values(pages)) {
      if (page.thumbnail?.source) return page.thumbnail.source;
    }
    console.log(`[image/wiki] ${title} → no thumbnail in response`);
  } catch (e) {
    console.error(`[image/wiki] ${title} → fetch error:`, e);
  }
  return "";
}

async function fetchFromWikipedia(topic: string, hint: string): Promise<string> {
  // 1. Exact title lookup
  const direct = await wikiPageImage(topic);
  if (direct) {
    console.log(`[image] Wikipedia direct hit: ${topic}`);
    return direct;
  }

  // 2. Search Wikipedia, try top 3 results
  const q = `${topic} ${hint}`.trim();
  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json`,
      { headers: { "User-Agent": WIKI_UA } }
    );
    if (!searchRes.ok) {
      console.warn(`[image/wiki-search] ${q} → HTTP ${searchRes.status}`);
      return "";
    }
    const searchData = await searchRes.json();
    const results: { title: string }[] = searchData?.query?.search ?? [];
    console.log(`[image/wiki-search] "${q}" → ${results.map(r => r.title).join(", ") || "no results"}`);
    for (const r of results) {
      const img = await wikiPageImage(r.title);
      if (img) {
        console.log(`[image] Wikipedia search hit: ${r.title}`);
        return img;
      }
    }
  } catch (e) {
    console.error(`[image/wiki-search] ${q} → error:`, e);
  }
  return "";
}

// ── Pexels ────────────────────────────────────────────────────────────────────

async function fetchFromPexels(topic: string, category: string, variant: number): Promise<string> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    console.warn("[image/pexels] PEXELS_API_KEY not set — skipping");
    return "";
  }

  const categoryHint = PEXELS_HINTS[category] ?? "";
  const queries = [
    `${topic} ${categoryHint}`.trim(),
    categoryHint || topic,
  ];

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15&orientation=landscape`,
        { headers: { Authorization: key } }
      );
      if (!res.ok) {
        console.warn(`[image/pexels] "${q}" → HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const photos: { src: { large: string } }[] = data?.photos ?? [];
      if (photos.length > 0) {
        const pick = photos[variant % photos.length];
        console.log(`[image] Pexels hit: "${q}" variant=${variant} → ${pick.src.large}`);
        return pick.src.large;
      }
      console.log(`[image/pexels] "${q}" → 0 results`);
    } catch (e) {
      console.error(`[image/pexels] "${q}" → error:`, e);
    }
  }
  return "";
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const topic    = (req.nextUrl.searchParams.get("topic")    ?? "").trim();
  const category = (req.nextUrl.searchParams.get("category") ?? "").trim();
  const variant  = Math.max(0, parseInt(req.nextUrl.searchParams.get("variant") ?? "0", 10) || 0);

  if (!topic) {
    return NextResponse.json({ url: "" }, { status: 400 });
  }

  const cacheKey = `${topic}::${category}::${variant}`;

  // Only serve from server cache if we have a real URL — never serve stale empty results
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    return NextResponse.json(
      { url: cached },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  console.log(`[image] lookup: "${topic}" / "${category}" / variant=${variant}`);

  try {
    // 1. Pexels first — fast CDN, great for all topic types
    let url = await fetchFromPexels(topic, category, variant);

    // 2. Wikipedia fallback — for topics Pexels doesn't cover well
    if (!url) {
      console.log(`[image] Pexels empty → trying Wikipedia for "${topic}"`);
      url = await fetchFromWikipedia(topic, WIKI_HINTS[category] ?? "");
    }

    if (!url) {
      console.warn(`[image] no image found for "${topic}" / "${category}"`);
      // Don't cache misses — allow retry on next request
      return NextResponse.json({ url: "" }, { headers: { "Cache-Control": "no-store" } });
    }

    cache.set(cacheKey, url);
    return NextResponse.json(
      { url },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error(`[image] unhandled error for "${topic}":`, e);
    // Don't cache errors — allow retry
    return NextResponse.json({ url: "" }, { headers: { "Cache-Control": "no-store" } });
  }
}
