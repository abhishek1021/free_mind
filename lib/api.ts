export interface MythCard {
  id: string;
  deityName: string;  // the topic title (deity, "Black Holes", "Stoicism", etc.)
  fact: string;
  imageUrl: string;
  wikipediaUrl: string;
  category: string;   // "Mythology", "Science", "History", etc.
  factIndex: number;
  totalFacts: number;
}

export interface GeminiResponse {
  deity: string;
  facts: string[];
  imageUrl: string;
  wikipediaUrl: string;
  category: string;
  source: string;
  total_facts_available: number;
}

export interface CategoryMeta {
  emoji: string;
  color: string;
  topics: string[];
}

export const CONTENT_CATEGORIES: Record<string, CategoryMeta> = {
  "Mythology": {
    emoji: "⚡",
    color: "#4f46e5",
    topics: ["Krishna", "Shiva", "Vishnu", "Ganesha", "Brahma", "Indra", "Agni", "Surya", "Yama",
             "Rama", "Narasimha", "Kalki", "Lakshmi", "Saraswati", "Parvati", "Kali", "Durga",
             "Sita", "Radha", "Hanuman", "Ravana", "Arjuna", "Karna", "Bhima", "Bhishma", "Narada"],
  },
  "Science": {
    emoji: "🔬",
    color: "#0891b2",
    topics: ["Black Holes", "Quantum Physics", "Human Brain", "DNA & Genetics", "Evolution",
             "Ocean Depths", "Space Exploration", "Light & Optics", "Climate Science", "Volcanoes",
             "Dinosaurs", "Artificial Intelligence", "The Big Bang", "Antimatter"],
  },
  "History": {
    emoji: "📜",
    color: "#d97706",
    topics: ["Ancient Egypt", "Roman Empire", "World War II", "Renaissance", "Silk Road",
             "Ancient India", "Greek Civilization", "Medieval Europe", "Cold War",
             "Industrial Revolution", "Ancient China", "Vikings", "The Ottoman Empire", "French Revolution"],
  },
  "Life Hacks": {
    emoji: "💡",
    color: "#059669",
    topics: ["Productivity", "Memory Techniques", "Better Sleep", "Focus & Flow", "Speed Learning",
             "Habit Building", "Communication Skills", "Decision Making", "Time Management", "Stress Relief"],
  },
  "Riddles": {
    emoji: "🧩",
    color: "#db2777",
    topics: ["Logic Riddles", "Math Puzzles", "Word Riddles", "Brain Teasers", "Classic Riddles", "Lateral Thinking"],
  },
  "Psychology": {
    emoji: "🧠",
    color: "#7c3aed",
    topics: ["Cognitive Biases", "Human Behavior", "Memory & Learning", "Motivation", "Social Psychology",
             "Emotions", "Persuasion", "Dreams & Sleep", "Perception", "Personality"],
  },
  "World Facts": {
    emoji: "🌍",
    color: "#2563eb",
    topics: ["Extreme Geography", "Animal Kingdom", "Languages", "Food Origins",
             "Architecture Wonders", "Cultural Traditions", "Deep Sea Creatures", "Natural Phenomena"],
  },
  "Philosophy": {
    emoji: "🏛️",
    color: "#64748b",
    topics: ["Stoicism", "Existentialism", "Ethics", "Consciousness", "Free Will",
             "Meaning of Life", "Eastern Philosophy", "Ancient Wisdom", "Absurdism"],
  },
  "Short Stories": {
    emoji: "📖",
    color: "#c2410c",
    topics: ["Tales from the Arabian Nights", "Sinbad the Sailor", "Ali Baba and the Forty Thieves",
             "Scheherazade", "Tales from Ancient Persia", "Stories from Ancient Greece",
             "Aesop's Fables", "Tales from Ancient China", "Norse Legends",
             "Stories from the Silk Road", "Tales of Nasreddin Hodja", "African Folk Tales"],
  },
  "Moral Stories": {
    emoji: "🌿",
    color: "#15803d",
    topics: ["Panchatantra", "Hitopadesha", "Jataka Tales", "Tenali Rama Stories",
             "Birbal Stories", "Vikram and Betaal", "Stories of Mulla Nasruddin",
             "Aesop's Moral Fables", "Sufi Wisdom Stories", "Buddhist Parables",
             "Stories of King Solomon", "Tales of Confucius"],
  },
};

// Kept for backward-compat with old bookmarks
export const CATEGORIES: Record<string, string[]> = Object.fromEntries(
  Object.entries(CONTENT_CATEGORIES).map(([k, v]) => [k, v.topics])
);

export function randomDeity(category?: string): string {
  const cat = category && CONTENT_CATEGORIES[category];
  const pool = cat ? cat.topics : Object.values(CONTENT_CATEGORIES).flatMap((c) => c.topics);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function randomCategory(): string {
  const keys = Object.keys(CONTENT_CATEGORIES);
  return keys[Math.floor(Math.random() * keys.length)];
}

export function geminiToCards(resp: GeminiResponse): MythCard[] {
  return resp.facts.map((fact, i) => ({
    id: `${resp.category}::${resp.deity}::${i}`,
    deityName: resp.deity,
    fact,
    imageUrl: resp.imageUrl,
    wikipediaUrl: resp.wikipediaUrl,
    category: resp.category ?? "General",
    factIndex: i,
    totalFacts: resp.facts.length,
  }));
}

export async function fetchGeminiCards(topic: string, category = "Mythology", count = 15): Promise<MythCard[]> {
  const url = `/api/gemini/facts?topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}&count=${count}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data: GeminiResponse = await res.json();
  if (!data.facts?.length) throw new Error("No facts returned");
  return geminiToCards(data);
}

export async function fetchRandomGeminiCards(category?: string): Promise<MythCard[]> {
  const cat = category ?? randomCategory();
  const topic = randomDeity(cat);
  return fetchGeminiCards(topic, cat);
}

// Fetch one fact each from `count` different random categories in parallel
export async function fetchMixedBatch(count = 5): Promise<MythCard[]> {
  const cats = Object.keys(CONTENT_CATEGORIES);
  const shuffled = [...cats].sort(() => Math.random() - 0.5);
  const picks = Array.from({ length: count }, (_, i) => {
    const cat = shuffled[i % cats.length];
    return { cat, topic: randomDeity(cat) };
  });
  const results = await Promise.allSettled(
    picks.map(({ cat, topic }) => fetchGeminiCards(topic, cat, 1))
  );
  return results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => (r as PromiseFulfilledResult<MythCard[]>).value);
}

// Category-specific search hints so Wikipedia finds visually rich articles
const CATEGORY_SEARCH_HINTS: Record<string, string> = {
  "Life Hacks":     "self improvement productivity",
  "Philosophy":     "ancient philosophy",
  "Psychology":     "cognitive psychology",
  "Science":        "scientific discovery",
  "History":        "historical event",
  "World Facts":    "geography nature",
  "Riddles":        "puzzle logic",
  "Short Stories":  "literature tale",
  "Moral Stories":  "fable folklore",
  "Mythology":      "Hindu mythology",
};

async function fetchSummaryImage(title: string): Promise<string> {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  );
  if (!res.ok) return "";
  const data = await res.json();
  return data.originalimage?.source ?? data.thumbnail?.source ?? "";
}

// Client-side only — browser can reach Wikipedia directly
export async function fetchDeityImageUrl(topic: string, category = ""): Promise<string> {
  const slug = topic.replace(/\s*[&+]\s*/g, " ").trim().replace(/\s+/g, "_");
  try {
    // 1. Try direct page summary with the topic slug
    const img1 = await fetchSummaryImage(slug);
    if (img1) return img1;

    // 2. Search Wikipedia with topic + category hint for a better match
    const hint = CATEGORY_SEARCH_HINTS[category] ?? "";
    const query = `${topic} ${hint}`.trim();
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`
    );
    if (!searchRes.ok) return "";
    const searchData = await searchRes.json();
    const results: { title: string }[] = searchData?.query?.search ?? [];

    // Try each search result until we find one with an image
    for (const result of results) {
      const img = await fetchSummaryImage(result.title);
      if (img) return img;
    }
    return "";
  } catch {
    return "";
  }
}
