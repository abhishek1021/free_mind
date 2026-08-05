import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function buildPrompt(topic: string, category: string, count: number, isStory: boolean): string {
  const wordLimit = isStory ? "3-5 sentences, max 80 words" : "1-2 short sentences, max 35 words";
  const rules = `STRICT RULES for every entry:
- Write in plain everyday English — like talking to a curious 14-year-old
- If a technical word is unavoidable, explain it simply in the same sentence
- ${wordLimit} per entry
- No filler openers like "Did you know", "It is said that", "Interestingly", "Once upon a time"

Return ONLY valid JSON — no markdown, no code blocks:
{"topic": "${topic}", "category": "${category}", "facts": ["entry 1", ...]}`;

  switch (category) {
    case "Science":
      return `You explain science to everyday people in the simplest way possible. Generate ${count} surprising facts about "${topic}".\n${rules}\nAvoid words like "quantum", "phenomenon", "molecular" unless immediately explained in plain words.`;
    case "History":
      return `You tell history like exciting short stories. Generate ${count} surprising facts about "${topic}".\n${rules}\nUse real names, places, and numbers. Focus on the human story, not academic language.`;
    case "Life Hacks":
      return `You share practical tips anyone can use today. Generate ${count} life hacks about "${topic}".\n${rules}\nStart with an action verb. Make each tip something someone can try in the next 5 minutes.`;
    case "Riddles":
      return `Generate ${count} fun riddles about "${topic}" with answers.\n${rules}\nFormat each as: "Q: [riddle] → A: [answer]". Keep the language simple and the answer satisfying.`;
    case "Psychology":
      return `You explain how the human mind works in simple terms. Generate ${count} fascinating facts about "${topic}".\n${rules}\nDescribe real effects and behaviors — skip clinical terms, use plain descriptions of what actually happens.`;
    case "World Facts":
      return `You share jaw-dropping facts about the world. Generate ${count} surprising facts about "${topic}".\n${rules}\nPick facts that make people say "wait, really?" — bizarre, record-breaking, or totally unexpected.`;
    case "Philosophy":
      return `You make big ideas feel simple and useful. Generate ${count} thought-provoking insights about "${topic}".\n${rules}\nExpress each idea as something a person can feel or relate to in daily life. Skip Latin phrases and abstract terms.`;
    case "Short Stories":
      return `You are a master Indian storyteller. Generate ${count} ultra-short stories drawn ONLY from Indian traditions — Indian mythology (Ramayana, Mahabharata, Puranas), Panchatantra, Akbar-Birbal tales, Tenali Raman stories, Jataka tales, or classic Indian folk stories. The topic is "${topic}". Each story must be a complete tale with a beginning, a twist or surprise, and an ending.\n${rules}\nWrite ENTIRELY in Hindi (Devanagari script). Do not use any English words. Use simple, conversational Hindi that a common Indian person can easily read and enjoy — as if a dadi is telling the story. Do NOT use Western, Greek, Chinese, or non-Indian stories.`;
    case "Moral Stories":
      return `You are a master Indian storyteller. Generate ${count} short moral stories drawn ONLY from Indian traditions — Panchatantra, Akbar-Birbal, Tenali Raman, Jataka tales, Indian mythology (Ramayana, Mahabharata, Puranas), or classic Indian folk tales. The topic is "${topic}". Each story must teach a clear life lesson.\n${rules}\nWrite ENTIRELY in Hindi (Devanagari script). Do not use any English words. Use simple, conversational Hindi that a child can understand — as if a nani is telling a bedtime story. End each story with "नैतिक शिक्षा: [एक सरल वाक्य में सीख]". Do NOT use Western, Greek, Chinese, or non-Indian stories.`;
    case "Mythology":
    default:
      return `You are a deep scholar of Indian mythology who knows the hidden, lesser-known stories that most people have never heard. Generate ${count} surprising, rare facts about ${topic} from Indian mythology.\n${rules}\nSTRICT RULES for Mythology:\n- Write in Hinglish — natural mix of Hindi and English the way Indians speak (e.g. "Kya aap jaante hain ki..." or "Bahut kam log jaante hain ki..." mixed with English). Feel like a knowledgeable friend sharing a secret.\n- ONLY pick facts that are genuinely rare and obscure — things most Indians and even mythology enthusiasts do not know. Avoid well-known stories like Ram vs Ravana, Krishna's Mahabharata role, or Ganesha's elephant head origin.\n- Dig into lesser-known Puranas, regional variations, hidden curses, forgotten characters, surprising family relationships, alternate versions of famous stories, and unusual divine powers.\n- Every fact should make the reader think "main yeh pehle nahi jaanta tha!" (I didn't know this before!)\n- No scholarly jargon — tell it like a campfire secret.`;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const topic = (searchParams.get("topic") ?? searchParams.get("deity") ?? "Krishna").trim();
  const category = (searchParams.get("category") ?? "Mythology").trim();
  const isStory = ["Short Stories", "Moral Stories"].includes(category);
  const count = Math.min(parseInt(searchParams.get("count") ?? (isStory ? "10" : "15")), 20);

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
  const prompt = buildPrompt(topic, category, count, isStory);

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    // Strip markdown code fences if present
    let cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Extract the first complete JSON object — handles extra text before/after
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

    // Remove trailing commas before } or ] which Gemini occasionally emits
    cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

    let parsed: { topic?: string; category?: string; facts?: string[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Last resort: try to salvage just the facts array
      const factsMatch = cleaned.match(/"facts"\s*:\s*(\[[\s\S]*?\])/);
      if (!factsMatch) throw new Error(`Unparseable response: ${cleaned.slice(0, 200)}`);
      parsed = { facts: JSON.parse(factsMatch[1]) };
    }

    const facts = Array.isArray(parsed.facts) ? parsed.facts.filter(Boolean) : [];

    return NextResponse.json({
      deity: parsed.topic ?? topic,
      facts,
      imageUrl: "",
      wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic)}`,
      category: parsed.category ?? category,
      source: "Gemini AI",
      total_facts_available: facts.length,
    });
  } catch (err) {
    console.error("[gemini/facts]", err);
    return NextResponse.json({ error: "Failed to generate facts", detail: String(err) }, { status: 500 });
  }
}
