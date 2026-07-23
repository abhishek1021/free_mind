export type CardType = "fact" | "riddle" | "hack" | "story" | "quote" | "didyouknow";

export interface Card {
  id: string;
  type: CardType;
  title?: string;
  content: string;
  answer?: string; // for riddles
  source?: string; // for quotes
  emoji: string;
  imageUrl?: string;
}

export const cards: Card[] = [
  // FACTS
  {
    id: "f1",
    type: "fact",
    title: "Napoleon vs Rabbits",
    content: "Napoleon Bonaparte was once attacked by a swarm of rabbits. After Austerlitz, he ordered a rabbit hunt to celebrate — but his marshals collected domestic rabbits instead of wild ones. The rabbits charged Napoleon en masse, overrunning him completely.",
    emoji: "🐇",
  },
  {
    id: "f2",
    type: "fact",
    title: "Oxford University is Older than the Aztec Empire",
    content: "Teaching began at Oxford around 1096–1167 AD. The Aztec Empire was founded in 1428 AD. Oxford was already over 250 years old before the Aztecs built Tenochtitlan.",
    emoji: "🏛️",
  },
  {
    id: "f3",
    type: "fact",
    title: "Cleopatra Lived Closer to the Moon Landing Than to Pyramids",
    content: "Cleopatra died in 30 BC. The Great Pyramid was built around 2560 BC — that's 2,500 years before her. The Moon landing was in 1969 — just 2,000 years after her. She was closer in time to us than to the pyramid builders.",
    emoji: "🌕",
    imageUrl: "https://images.unsplash.com/photo-1600520611035-84157ad4084d?w=800&q=80",
  },
  {
    id: "f4",
    type: "fact",
    title: "Honey Never Expires",
    content: "Archaeologists found 3,000-year-old honey in Egyptian tombs — and it was still perfectly edible. Honey's low moisture and acidic pH make it nearly impossible for bacteria to grow.",
    emoji: "🍯",
    imageUrl: "https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=800&q=80",
  },
  {
    id: "f5",
    type: "fact",
    title: "The Eiffel Tower Grows in Summer",
    content: "Heat causes metal to expand. The Eiffel Tower grows by up to 15 cm (6 inches) during summer due to thermal expansion of its iron structure.",
    emoji: "🗼",
    imageUrl: "https://images.unsplash.com/photo-1570097703229-b195d6dd291f?w=800&q=80",
  },
  {
    id: "f6",
    type: "fact",
    title: "A Day on Venus is Longer Than its Year",
    content: "Venus rotates so slowly that one full rotation (a day) takes 243 Earth days. But it orbits the Sun in just 225 Earth days — meaning its day is longer than its year.",
    emoji: "🪐",
    imageUrl: "https://images.unsplash.com/photo-1552084007-76f5feb8d22a?w=800&q=80",
  },
  {
    id: "f7",
    type: "fact",
    title: "Scotland's National Animal is a Unicorn",
    content: "The unicorn has been Scotland's national animal since the 12th century. In Celtic mythology, it represented purity, power, and independence — traits Scots fiercely identified with.",
    emoji: "🦄",
  },
  {
    id: "f8",
    type: "fact",
    title: "There Are More Possible Chess Games Than Atoms in the Universe",
    content: "The number of possible unique chess games is estimated at 10^120 — a number called the Shannon Number. The observable universe has roughly 10^80 atoms. Chess is literally incomprehensibly complex.",
    emoji: "♟️",
    imageUrl: "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=800&q=80",
  },
  {
    id: "f9",
    type: "fact",
    title: "The shortest war in history lasted 38–45 minutes",
    content: "The Anglo-Zanzibar War of 1896 lasted between 38 and 45 minutes. Zanzibar surrendered almost immediately after British ships opened fire on the royal palace.",
    emoji: "⚔️",
  },
  {
    id: "f10",
    type: "fact",
    title: "Bananas Are Berries, But Strawberries Aren't",
    content: "Botanically, a berry must develop from a single flower with one ovary. Bananas qualify. Strawberries develop from a flower with multiple ovaries — making them 'aggregate fruits', not berries.",
    emoji: "🍌",
  },

  // RIDDLES
  {
    id: "r1",
    type: "riddle",
    content: "I have cities, but no houses live there. I have mountains, but no trees grow. I have water, but no fish swim. I have roads, but no cars drive. What am I?",
    answer: "A map.",
    emoji: "🗺️",
  },
  {
    id: "r2",
    type: "riddle",
    content: "The more you take, the more you leave behind. What am I?",
    answer: "Footsteps.",
    emoji: "👣",
  },
  {
    id: "r3",
    type: "riddle",
    content: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?",
    answer: "An echo.",
    emoji: "🔊",
  },
  {
    id: "r4",
    type: "riddle",
    content: "I can fly without wings. I can cry without eyes. Wherever I go, darkness follows me. What am I?",
    answer: "A cloud.",
    emoji: "☁️",
  },
  {
    id: "r5",
    type: "riddle",
    content: "What has hands but can't clap, a face but can't smile, and tells you something every minute but never speaks?",
    answer: "A clock.",
    emoji: "🕰️",
  },
  {
    id: "r6",
    type: "riddle",
    content: "I'm not alive, but I grow. I don't have lungs, but I need air. I don't have a mouth, but water kills me. What am I?",
    answer: "Fire.",
    emoji: "🔥",
  },
  {
    id: "r7",
    type: "riddle",
    content: "You see me once in June, twice in November, and not at all in May. What am I?",
    answer: "The letter 'e'.",
    emoji: "🔤",
  },
  {
    id: "r8",
    type: "riddle",
    content: "I have a head and a tail, but no body. What am I?",
    answer: "A coin.",
    emoji: "🪙",
  },

  // LIFE HACKS
  {
    id: "h1",
    type: "hack",
    title: "The 2-Minute Rule",
    content: "If a task takes less than 2 minutes, do it immediately. Don't schedule it, don't write it down — just do it. This eliminates the mental overhead of tracking tiny tasks and clears your mind for bigger work.",
    emoji: "⏱️",
  },
  {
    id: "h2",
    type: "hack",
    title: "Beat Procrastination with a Timer",
    content: "Tell yourself: 'I'll work on this for just 5 minutes.' Set a timer. Starting is the hardest part — once you begin, momentum usually carries you forward. The timer removes the pressure of committing to a full session.",
    emoji: "🍅",
  },
  {
    id: "h3",
    type: "hack",
    title: "Remember Names Instantly",
    content: "When you meet someone, use their name in your first response: 'Nice to meet you, Sarah.' This commits it to short-term memory. Then connect their name to a visual or someone you already know named Sarah.",
    emoji: "🧠",
  },
  {
    id: "h4",
    type: "hack",
    title: "The Best Time to Nap",
    content: "A 10–20 minute nap between 1–3 PM aligns with your natural circadian dip and won't disrupt night sleep. Set an alarm for 25 minutes — it takes ~5 minutes to fall asleep. Longer than 30 min risks sleep inertia (grogginess).",
    emoji: "😴",
  },
  {
    id: "h5",
    type: "hack",
    title: "Calm Nerves in 60 Seconds",
    content: "Breathe in for 4 seconds, hold for 4, breathe out for 8. The extended exhale activates your parasympathetic nervous system — your body's 'rest' mode. Three cycles of this can measurably slow your heart rate.",
    emoji: "🌬️",
  },
  {
    id: "h6",
    type: "hack",
    title: "Read More Books, Actually",
    content: "Keep your book in the most boring place you visit daily — your bathroom. 10 minutes a day there is 60+ hours a year. That's 15–20 books, depending on length. No dedicated 'reading time' required.",
    emoji: "📚",
  },
  {
    id: "h7",
    type: "hack",
    title: "Stop Forgetting Why You Walked Into a Room",
    content: "The 'doorway effect' is real — your brain treats each room as a new context, erasing recent thoughts. Fix it: say out loud what you're going for before you walk in. Verbalizing engages a different memory pathway.",
    emoji: "🚪",
  },
  {
    id: "h8",
    type: "hack",
    title: "Make Decisions Faster",
    content: "Use the 10/10/10 rule: Will this matter in 10 minutes? 10 months? 10 years? Most things that feel urgent only score high on the first one — and that's enough to stop overthinking them.",
    emoji: "🎯",
  },

  // SHORT STORIES
  {
    id: "s1",
    type: "story",
    title: "The Astronaut's Letter",
    content: "Before Apollo 11 launched, NASA speechwriter William Safire wrote a contingency speech for President Nixon — to be read if Armstrong and Aldrin were stranded on the Moon and couldn't return.\n\nIt began: 'Fate has ordained that the men who went to the Moon to explore in peace will stay on the Moon to rest in peace.'\n\nThe speech was never needed. But it was ready.",
    emoji: "🚀",
    imageUrl: "https://images.unsplash.com/photo-1517976487492-5750f3195933?w=800&q=80",
  },
  {
    id: "s2",
    type: "story",
    title: "The Night Before the Mona Lisa Disappeared",
    content: "On August 21, 1911, a Louvre employee named Vincenzo Peruggia hid inside a broom closet overnight. The next morning he walked out, took the Mona Lisa off the wall, hid it under his coat, and left.\n\nThe painting was missing for two years. When he tried to sell it to an art dealer in Florence, he was caught. The Mona Lisa became world-famous largely because of the theft.",
    emoji: "🎨",
  },
  {
    id: "s3",
    type: "story",
    title: "The Soldier Who Didn't Know the War Was Over",
    content: "Hiroo Onoda was a Japanese soldier stationed in the Philippine jungle. In 1945, Japan surrendered — but no one told Onoda. He kept fighting, following his last orders, for 29 years.\n\nIn 1974, his former commanding officer flew to the Philippines and personally issued his surrender orders. Onoda came out of the jungle in full uniform, rifle still in working condition.",
    emoji: "🪖",
  },
  {
    id: "s4",
    type: "story",
    title: "The Blind Mountain Climber",
    content: "In 2001, Erik Weihenmayer became the first blind person to summit Mount Everest. His team used a system of bells and verbal cues. When he reached the top, he said he couldn't see the view — but he could feel the wind, and that was enough.\n\nHe later climbed all Seven Summits — the highest peak on every continent.",
    emoji: "🏔️",
    imageUrl: "https://images.unsplash.com/photo-1634040843188-5ca36cf26cc1?w=800&q=80",
  },
  {
    id: "s5",
    type: "story",
    title: "The Library of Every Book Ever Written",
    content: "In 1939, Jorge Luis Borges wrote a story about a Library containing every possible combination of 410 pages of text — every book that has ever been written, and every book that could ever be written.\n\nMost books in the Library are meaningless gibberish. A few contain profound truths. Librarians spend their lives searching. No one has ever found anything useful.\n\nThe story is 8 pages long and describes infinity.",
    emoji: "📖",
  },

  // DID YOU KNOW
  {
    id: "d1",
    type: "didyouknow",
    content: "A group of flamingos is called a 'flamboyance.' A group of crows is called a 'murder.' A group of owls is called a 'parliament.' And a group of cats is called a 'clowder.'",
    emoji: "🦩",
  },
  {
    id: "d2",
    type: "didyouknow",
    content: "The Hawaiian alphabet has only 13 letters: A, E, I, O, U, H, K, L, M, N, P, W, and the ʻokina (a glottal stop). Despite this, Hawaiian has a remarkably rich linguistic tradition.",
    emoji: "🌺",
  },
  {
    id: "d3",
    type: "didyouknow",
    content: "Octopuses have three hearts, blue blood, and nine brains — one central brain and one in each arm. Each arm can act independently and solve problems even when severed from the body.",
    emoji: "🐙",
  },
  {
    id: "d4",
    type: "didyouknow",
    content: "The 'thumbs up' gesture we think is positive actually had a different meaning in Roman gladiatorial combat. Modern historians believe 'thumbs up' may have meant 'death' and 'thumbs hidden inside fist' meant 'spare him' — we just got it backwards through Hollywood.",
    emoji: "👍",
  },
  {
    id: "d5",
    type: "didyouknow",
    content: "There is a species of jellyfish — Turritopsis dohrnii — that is technically biologically immortal. When it gets old or stressed, it reverts back to its juvenile polyp stage and starts its lifecycle over again.",
    emoji: "🪼",
    imageUrl: "https://images.unsplash.com/photo-1495012379376-194a416fcc5f?w=800&q=80",
  },
  {
    id: "d6",
    type: "didyouknow",
    content: "The smell of rain — petrichor — comes from a compound called geosmin released by soil bacteria when rainwater hits dry earth. Humans can detect geosmin at concentrations as low as 5 parts per trillion. We're incredibly sensitive to it.",
    emoji: "🌧️",
    imageUrl: "https://images.unsplash.com/photo-1501691223387-dd0500403074?w=800&q=80",
  },
  {
    id: "d7",
    type: "didyouknow",
    content: "Your body replaces most of its cells over time, but your neurons (brain cells) and the lens cells in your eyes are largely with you from birth to death. In a sense, your eyes are as old as you are.",
    emoji: "👁️",
  },

  // QUOTES
  {
    id: "q1",
    type: "quote",
    content: "The impediment to action advances action. What stands in the way becomes the way.",
    source: "Marcus Aurelius",
    emoji: "⚡",
  },
  {
    id: "q2",
    type: "quote",
    content: "We suffer more in imagination than in reality.",
    source: "Seneca",
    emoji: "🧘",
    imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80",
  },
  {
    id: "q3",
    type: "quote",
    content: "It is not that we have a short time to live, but that we waste a great deal of it.",
    source: "Seneca",
    emoji: "⏳",
  },
  {
    id: "q4",
    type: "quote",
    content: "If you are distressed by anything external, the pain is not due to the thing itself, but to your estimate of it; and this you have the power to revoke at any moment.",
    source: "Marcus Aurelius",
    emoji: "🌅",
  },
  {
    id: "q5",
    type: "quote",
    content: "The whole future lies in uncertainty: live immediately.",
    source: "Seneca",
    emoji: "🎯",
  },
  {
    id: "q6",
    type: "quote",
    content: "Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.",
    source: "Rumi",
    emoji: "🌱",
  },
  {
    id: "q7",
    type: "quote",
    content: "Out beyond ideas of wrongdoing and rightdoing, there is a field. I'll meet you there.",
    source: "Rumi",
    emoji: "🌾",
  },
];

export function getShuffledCards(): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const cardTypeConfig: Record<CardType, { label: string; bg: string; accent: string; textColor: string }> = {
  fact: {
    label: "FACT",
    bg: "from-indigo-950 to-slate-900",
    accent: "bg-indigo-500",
    textColor: "text-indigo-300",
  },
  riddle: {
    label: "RIDDLE",
    bg: "from-violet-950 to-slate-900",
    accent: "bg-violet-500",
    textColor: "text-violet-300",
  },
  hack: {
    label: "LIFE HACK",
    bg: "from-emerald-950 to-slate-900",
    accent: "bg-emerald-500",
    textColor: "text-emerald-300",
  },
  story: {
    label: "STORY",
    bg: "from-amber-950 to-slate-900",
    accent: "bg-amber-500",
    textColor: "text-amber-300",
  },
  quote: {
    label: "QUOTE",
    bg: "from-rose-950 to-slate-900",
    accent: "bg-rose-500",
    textColor: "text-rose-300",
  },
  didyouknow: {
    label: "DID YOU KNOW",
    bg: "from-cyan-950 to-slate-900",
    accent: "bg-cyan-500",
    textColor: "text-cyan-300",
  },
};
