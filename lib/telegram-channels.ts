export interface TelegramChannel {
  username: string;   // without @ e.g. "bbcnews"
  name: string;       // display name
  category: string;   // matches your CONTENT_CATEGORIES keys
  emoji: string;
}

// ── Add your public channels here ─────────────────────────────
export const TELEGRAM_CHANNELS: TelegramChannel[] = [
  { username: "INTFACTSEN",                    name: "Interesting Facts",       category: "World Facts", emoji: "🌍" },
  { username: "CRAZY_MOMENTS_USA",             name: "Crazy Moments USA",       category: "World Facts", emoji: "😂" },
  { username: "USEFUL_TIPS_LIFEHACKS",         name: "Useful Tips & Hacks",     category: "Life Hacks",  emoji: "💡" },
  { username: "TIPSFORGOOD",                   name: "Tips For Good",           category: "Life Hacks",  emoji: "✅" },
  { username: "MEMES_COMEDY",                  name: "Memes & Comedy",          category: "World Facts", emoji: "🎭" },
  { username: "MQQUOTES",                      name: "Motivational Quotes",     category: "Philosophy",  emoji: "✨" },
  { username: "QUOTES_FACTS_ENGLISH_MOTIVATION", name: "Greatest Quotes",       category: "Philosophy",  emoji: "🏆" },
  { username: "INOWKNOW",                      name: "Now I Know",              category: "World Facts", emoji: "🧠" },
  { username: "YORSERIALLS",                   name: "Yorserialls",             category: "World Facts", emoji: "🎃" },
  { username: "FACTS",                         name: "Facts",                   category: "World Facts", emoji: "📋" },
  { username: "BUZZHISTORY",                   name: "Buzz History",            category: "History",     emoji: "📜" },
  { username: "GENERAL_KNOWLEDGETM",           name: "General Knowledge",       category: "World Facts", emoji: "💡" },
  { username: "WEIRD_FACTS_TM",                name: "Weird Facts",             category: "World Facts", emoji: "🤯" },
  { username: "DIDUKNOW0",                     name: "Did You Know?",           category: "World Facts", emoji: "❓" },
  { username: "DID_YOU_KNOW_MYSTERY",          name: "Did You Know Mystery",    category: "World Facts", emoji: "🔮" },
];

export const CHANNEL_CATEGORIES = [
  ...new Set(TELEGRAM_CHANNELS.map((c) => c.category)),
];
