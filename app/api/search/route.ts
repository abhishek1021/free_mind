import { NextRequest, NextResponse } from "next/server";
import { searchFacts, dbFactToCard } from "@/lib/dynamo-facts";

export const dynamic = "force-dynamic";

// 5-minute in-memory cache — same query within a session costs 0 additional reads
const cache = new Map<string, { cards: ReturnType<typeof dbFactToCard>[]; at: number }>();
const TTL   = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ facts: [], query: q });
  }

  const key    = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL) {
    return NextResponse.json({ facts: cached.cards, query: q, cached: true });
  }

  try {
    const facts = await searchFacts(q);
    const cards = facts.map(dbFactToCard);
    cache.set(key, { cards, at: Date.now() });
    return NextResponse.json({ facts: cards, query: q });
  } catch (err) {
    console.error("[search]", err);
    return NextResponse.json({ error: String(err), facts: [] }, { status: 500 });
  }
}
