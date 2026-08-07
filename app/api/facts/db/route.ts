import { NextRequest, NextResponse } from "next/server";
import {
  queryFactsByShard,
  queryFactsByTopic,
  dbFactToCard,
} from "@/lib/dynamo-facts";

export const dynamic = "force-dynamic";

// Non-story, non-riddle categories that are seeded in DynamoDB.
// Order matters: more popular categories first so mixed feed is richer.
const DB_CATEGORIES = [
  "Mythology", "Science", "History",
  "Life Hacks", "Psychology", "World Facts", "Philosophy",
  "Space & Astronomy", "Ancient Civilizations", "Health & Human Body",
  "Nature & Animals", "Technology & Innovations", "Mathematics & Numbers",
  "Art & Culture", "Famous Scientists & Inventors", "Economics & Business",
  "Food & Cuisine", "Language & Words",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category") ?? null;
  const topic    = searchParams.get("topic")    ?? null;
  const shard    = searchParams.get("shard") != null
    ? parseInt(searchParams.get("shard")!)
    : Math.floor(Math.random() * 10);

  try {
    // ── Topic-specific query (explore tab: user picked a topic chip) ──────────
    if (topic && category) {
      const facts = await queryFactsByTopic(category, topic, 15);
      // If topic not found in DB, return empty — client falls back to Gemini
      return NextResponse.json({ facts: facts.map(dbFactToCard), category, topic, shard });
    }

    // ── Category-specific query (feed tab: category chip selected) ────────────
    if (category) {
      const facts = await queryFactsByShard(category, shard, 80);
      return NextResponse.json({ facts: shuffle(facts).map(dbFactToCard), category, shard });
    }

    // ── Mixed feed: query all DB categories for this shard in parallel ─────────
    // Each category returns ~10% of its facts (one shard).
    // With 7 categories × ~10 facts each = ~70 mixed facts per request.
    const perCat = Math.ceil(70 / DB_CATEGORIES.length) + 5;
    const results = await Promise.all(
      DB_CATEGORIES.map(cat => queryFactsByShard(cat, shard, perCat))
    );

    // Interleave by category so feed looks varied (not all Mythology then all Science)
    const maxLen = Math.max(...results.map(r => r.length));
    const interleaved = [];
    for (let i = 0; i < maxLen; i++) {
      for (const catFacts of results) {
        if (i < catFacts.length) interleaved.push(catFacts[i]);
      }
    }

    return NextResponse.json({ facts: interleaved.map(dbFactToCard), shard });
  } catch (err) {
    console.error("[facts/db]", err);
    return NextResponse.json({ error: String(err), facts: [] }, { status: 500 });
  }
}
