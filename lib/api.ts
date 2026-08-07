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
  "Space & Astronomy": {
    emoji: "🌌",
    color: "#0284c7",
    topics: ["Black Holes", "Neutron Stars", "The Big Bang", "Dark Matter", "Dark Energy",
             "Exoplanets", "The Sun", "The Moon", "Mars", "Jupiter", "Saturn", "Venus",
             "Milky Way", "Andromeda Galaxy", "Supernovas", "Wormholes",
             "NASA Missions", "James Webb Telescope", "International Space Station",
             "Comets & Asteroids", "The Oort Cloud", "Pulsars", "Quasars"],
  },
  "Ancient Civilizations": {
    emoji: "🏺",
    color: "#c2410c",
    topics: ["Mesopotamia", "Sumerian Civilization", "Ancient Babylon",
             "Indus Valley Civilization", "Ancient Greece", "Minoan Civilization",
             "Carthage", "Phoenicians", "Ancient China Han Dynasty",
             "Ancient Persia Achaemenid", "Olmec Civilization", "Ancient Maya",
             "Aztec Empire", "Inca Empire", "Ancient Nubia"],
  },
  "Health & Human Body": {
    emoji: "💊",
    color: "#dc2626",
    topics: ["The Human Brain", "The Heart & Circulatory System", "The Immune System",
             "Gut Microbiome", "Human Skeleton", "Hormones & Endocrine System",
             "The Human Eye", "Sleep Science", "Nutrition & Metabolism",
             "Exercise & Muscles", "Cancer Biology", "Vaccines & Immunity",
             "Antibiotics", "The Nervous System", "Blood Types",
             "Genetics & Heredity", "Aging & Longevity"],
  },
  "Nature & Animals": {
    emoji: "🌿",
    color: "#16a34a",
    topics: ["Deep Sea Creatures", "Amazon Rainforest", "Arctic & Antarctic",
             "Coral Reefs", "Apex Predators", "Insects & Pollinators",
             "Migration Patterns", "Animal Intelligence", "Plant Defense Mechanisms",
             "Symbiosis & Mutualism", "Fungi & Mycelium", "Endangered Species",
             "Bioluminescence", "Camouflage in Nature", "Animal Communication",
             "Whales & Cetaceans", "Birds of Prey", "Venomous Animals"],
  },
  "Technology & Innovations": {
    emoji: "⚙️",
    color: "#0d9488",
    topics: ["History of the Internet", "Artificial Intelligence", "Machine Learning",
             "Blockchain", "The Printing Press", "Steam Engine",
             "Electricity Tesla & Edison", "Telephone & Radio",
             "Semiconductors & Transistors", "Space Technology", "Robotics",
             "Quantum Computing", "Augmented & Virtual Reality", "Drones",
             "3D Printing", "Renewable Energy Solar", "Nuclear Energy", "Self-Driving Cars"],
  },
  "Mathematics & Numbers": {
    emoji: "∞",
    color: "#9333ea",
    topics: ["Pi", "Fibonacci Sequence", "Prime Numbers", "Infinity & Cantor",
             "Golden Ratio", "Euler's Identity", "Pythagoras", "Fermat's Last Theorem",
             "The Riemann Hypothesis", "Game Theory", "Probability & Statistics",
             "Chaos Theory", "Fractals", "Zero History & Impact",
             "Cryptography & Codes", "Graph Theory", "Topology"],
  },
  "Art & Culture": {
    emoji: "🎨",
    color: "#db2777",
    topics: ["Leonardo da Vinci", "Michelangelo", "Vincent van Gogh", "Pablo Picasso",
             "Frida Kahlo", "The Impressionist Movement", "Baroque Art",
             "The Louvre", "The Sistine Chapel", "Ancient Cave Paintings",
             "Classical Music Beethoven", "Classical Music Mozart", "Jazz Origins",
             "Rock & Roll History", "Hip-Hop Origins", "Ballet",
             "Traditional Indian Dance", "Japanese Kabuki"],
  },
  "Famous Scientists & Inventors": {
    emoji: "🔭",
    color: "#0369a1",
    topics: ["Isaac Newton", "Albert Einstein", "Marie Curie", "Nikola Tesla",
             "Charles Darwin", "Galileo Galilei", "Stephen Hawking", "Alan Turing",
             "Ada Lovelace", "Rosalind Franklin", "Archimedes", "Thomas Edison",
             "Alexander Fleming", "Carl Sagan", "Richard Feynman",
             "Gregor Mendel", "Srinivasa Ramanujan", "C.V. Raman"],
  },
  "Economics & Business": {
    emoji: "📈",
    color: "#ca8a04",
    topics: ["The Great Depression", "The 2008 Financial Crisis",
             "How the Stock Market Works", "Capitalism vs Socialism",
             "Adam Smith & The Wealth of Nations", "John Maynard Keynes",
             "Warren Buffett", "Steve Jobs & Apple", "The Rise of Amazon",
             "Bitcoin & Cryptocurrency", "Inflation & Deflation",
             "Monopolies in History", "The Tulip Mania", "Behavioral Economics"],
  },
  "Food & Cuisine": {
    emoji: "🍜",
    color: "#ea580c",
    topics: ["Origins of Bread", "History of Spices & The Spice Trade",
             "Fermentation Science", "How Chocolate Was Discovered",
             "History of Coffee", "Tea & Its Origins",
             "Street Food Around the World", "Why Food Goes Bad",
             "The Science of Taste", "The Maillard Reaction",
             "Umami The Fifth Taste", "History of Salt", "How Wine Is Made",
             "Food Preservation Methods", "History of Sugar"],
  },
  "Language & Words": {
    emoji: "🗣️",
    color: "#7c3aed",
    topics: ["Origin of English", "How Languages Evolve & Die", "Sign Languages",
             "Oldest Written Languages", "Sanskrit & Its Influence",
             "Latin & Its Legacy", "The Rosetta Stone",
             "Words with No English Translation", "False Cognates",
             "The Sapir-Whorf Hypothesis", "Pidgin & Creole Languages",
             "Constructed Languages Esperanto", "How Children Acquire Language",
             "Animal Communication vs Language", "The Most Complex Writing Systems"],
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

// Fetch facts from multiple random topics within the same category, then shuffle them together
export async function fetchCategoryMixedBatch(category: string): Promise<MythCard[]> {
  const topics = CONTENT_CATEGORIES[category]?.topics ?? [];
  if (topics.length === 0) return fetchRandomGeminiCards(category);

  // Pick up to 4 unique random topics from the category
  const shuffledTopics = [...topics].sort(() => Math.random() - 0.5);
  const picked = shuffledTopics.slice(0, Math.min(4, topics.length));
  const perTopic = Math.max(3, Math.ceil(12 / picked.length)); // ~12 total cards

  const results = await Promise.allSettled(
    picked.map((topic) => fetchGeminiCards(topic, category, perTopic))
  );

  const cards = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => (r as PromiseFulfilledResult<MythCard[]>).value);

  // Shuffle so topics are interleaved rather than grouped
  return cards.sort(() => Math.random() - 0.5);
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

// ── DynamoDB-backed fact fetching ─────────────────────────────
// Used by feed and explore for all non-story, non-riddle categories.
// Falls back to Gemini when DB returns no results (e.g. category not yet seeded).

// Categories served from DynamoDB
export const DB_CATEGORIES = new Set([
  "Mythology", "Science", "History",
  "Life Hacks", "Psychology", "World Facts", "Philosophy",
  "Space & Astronomy", "Ancient Civilizations", "Health & Human Body",
  "Nature & Animals", "Technology & Innovations", "Mathematics & Numbers",
  "Art & Culture", "Famous Scientists & Inventors", "Economics & Business",
  "Food & Cuisine", "Language & Words",
]);

// Categories that always use Gemini (stories or not seeded)
export const GEMINI_ONLY_CATEGORIES = new Set(["Short Stories", "Moral Stories", "Riddles"]);

export function isDbCategory(category: string): boolean {
  return DB_CATEGORIES.has(category);
}

async function _fetchDb(params: Record<string, string | number>): Promise<MythCard[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const res = await fetch(`/api/facts/db?${qs}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.facts) ? data.facts : [];
}

// Mixed feed from all DB categories for a given shard (0-9)
export async function fetchDbMixed(shard: number): Promise<MythCard[]> {
  return _fetchDb({ shard });
}

// Single category feed for a given shard
export async function fetchDbCategory(category: string, shard: number): Promise<MythCard[]> {
  return _fetchDb({ category, shard });
}

// Topic-specific for explore tab; returns [] if topic not in DB → caller uses Gemini
export async function fetchDbTopic(category: string, topic: string): Promise<MythCard[]> {
  return _fetchDb({ category, topic });
}

// ── Client-side image cache (browser session) ─────────────────
// Prevents re-fetching the same topic within the same page session.
const _imgCache = new Map<string, string>();

// Fetch image URL via the server-side /api/image route.
// The server maintains its own persistent cache and handles all Wikipedia
// rate-limiting — the client never talks to Wikipedia directly.
export async function fetchDeityImageUrl(topic: string, category = "", variant = 0): Promise<string> {
  const cacheKey = `${topic}::${category}::${variant}`;
  if (_imgCache.has(cacheKey)) return _imgCache.get(cacheKey)!;

  try {
    const res  = await fetch(
      `/api/image?topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}&variant=${variant}`
    );
    const data = await res.json();
    const url  = data.url ?? "";
    _imgCache.set(cacheKey, url);
    return url;
  } catch {
    _imgCache.set(cacheKey, "");
    return "";
  }
}
