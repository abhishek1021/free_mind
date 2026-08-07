/**
 * Server-side DynamoDB helpers for FreemindFacts.
 * Only import this from API routes — never from client components.
 *
 * Query strategy:
 *  - All reads go through GSI-1 (CategoryShardIndex): PK=category, SK=shard
 *  - No full-table scans ever
 *  - ProjectionExpression limits fields returned → lower data transfer cost
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { MythCard } from "./api";

const TABLE  = process.env.DYNAMODB_TABLE ?? "FreemindFacts";
const REGION = process.env.AWS_REGION     ?? "us-east-1";

let _doc: DynamoDBDocumentClient | null = null;
function doc(): DynamoDBDocumentClient {
  if (!_doc) {
    _doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _doc;
}

// ── Category name mapping ─────────────────────────────────────────────────────
// App category names → DB category names (as seeded by seed-facts.ts)

const TO_DB: Record<string, string> = {
  "Life Hacks":  "Life Hacks & Productivity",
  "Psychology":  "Psychology & Mind",
  "World Facts": "World Facts & Geography",
  "Philosophy":  "Philosophy & Wisdom",
};

const TO_APP: Record<string, string> = Object.fromEntries(
  Object.entries(TO_DB).map(([app, db]) => [db, app])
);

export function toDbCategory(appCategory: string): string {
  return TO_DB[appCategory] ?? appCategory;
}

export function toAppCategory(dbCategory: string): string {
  return TO_APP[dbCategory] ?? dbCategory;
}

// ── DB shape ──────────────────────────────────────────────────────────────────

export interface DbFact {
  factId:    string;
  category:  string;
  topic:     string;
  fact:      string;
  shard:     number;
  createdAt: string;
}

export function dbFactToCard(f: DbFact): MythCard {
  return {
    id:           f.factId,
    deityName:    f.topic,
    fact:         f.fact,
    imageUrl:     "",
    wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(f.topic)}`,
    category:     toAppCategory(f.category),
    factIndex:    0,
    totalFacts:   0,
  };
}

// ── GSI-1 query: one category × one shard ─────────────────────────────────────
// Returns up to `limit` facts for the given category + shard (0-9).
// ~10% of a category's facts live in each shard, so for Mythology (~1450 facts)
// one shard query returns ~145 facts — plenty to shuffle and pick from.

export async function queryFactsByShard(
  appCategory: string,
  shard: number,
  limit = 100,
): Promise<DbFact[]> {
  try {
    const res = await doc().send(new QueryCommand({
      TableName:                 TABLE,
      IndexName:                 "CategoryShardIndex",
      KeyConditionExpression:    "category = :cat AND #shard = :s",
      ExpressionAttributeValues: { ":cat": toDbCategory(appCategory), ":s": shard },
      Limit:                     limit,
      // Only fetch needed fields — reduces read cost and network transfer
      ProjectionExpression:      "factId, category, topic, #f, #shard, createdAt",
      ExpressionAttributeNames:  { "#f": "fact", "#shard": "shard" },
    }));
    return (res.Items ?? []) as DbFact[];
  } catch (err) {
    console.error(`[dynamo-facts] queryFactsByShard(${appCategory}/${shard}):`, err);
    return [];
  }
}

// ── Keyword search: query one random shard per category, filter in-memory ────
// Cost: identical to one mixed-feed load (18 parallel shard queries).
// No scan, no new GSI needed — reuses CategoryShardIndex exclusively.
// Topic matches are ranked above fact-text matches for relevance.

const SEARCH_CATEGORIES = [
  "Mythology", "Science", "History", "Life Hacks", "Psychology",
  "World Facts", "Philosophy", "Space & Astronomy", "Ancient Civilizations",
  "Health & Human Body", "Nature & Animals", "Technology & Innovations",
  "Mathematics & Numbers", "Art & Culture", "Famous Scientists & Inventors",
  "Economics & Business", "Food & Cuisine", "Language & Words",
];

export async function searchFacts(query: string): Promise<DbFact[]> {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const shard = Math.floor(Math.random() * 10);
  const perCat = await Promise.all(
    SEARCH_CATEGORIES.map(cat => queryFactsByShard(cat, shard, 100))
  );

  const topicMatches: DbFact[] = [];
  const factMatches:  DbFact[] = [];
  for (const catFacts of perCat) {
    for (const f of catFacts) {
      if (f.topic.toLowerCase().includes(q))      topicMatches.push(f);
      else if (f.fact.toLowerCase().includes(q))  factMatches.push(f);
    }
  }

  return [...topicMatches, ...factMatches].slice(0, 30);
}

// ── Topic query: scan several random shards and filter by topic ───────────────
// Used by the explore tab when the user picks a specific topic chip.
// Tries up to `maxShards` random shards and stops once `needed` facts found.
// Gracefully returns [] if the topic isn't in the DB (caller falls back to Gemini).

export async function queryFactsByTopic(
  appCategory: string,
  topic: string,
  needed    = 12,
  maxShards = 4,
): Promise<DbFact[]> {
  const shards = Array.from({ length: 10 }, (_, i) => i)
    .sort(() => Math.random() - 0.5)
    .slice(0, maxShards);

  const results: DbFact[] = [];
  for (const shard of shards) {
    const items = await queryFactsByShard(appCategory, shard, 100);
    results.push(...items.filter(f => f.topic === topic));
    if (results.length >= needed) break;
  }
  return results;
}
