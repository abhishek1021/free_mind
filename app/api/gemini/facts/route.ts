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
      return `You are a master storyteller. Generate ${count} ultra-short stories from "${topic}" — each a complete tale with a beginning, a twist or surprise, and an ending.\n${rules}\nWrite in plain conversational English. Make each story feel like a campfire tale — vivid, quick, and memorable.`;
    case "Moral Stories":
      return `You retell classic moral stories in simple, engaging language. Generate ${count} short stories from "${topic}" — each with a clear moral at the end.\n${rules}\nWrite like you are telling a story to a child. End each story with "Moral: [one simple sentence lesson]".`;
    case "Mythology":
    default:
      return `You bring Indian mythology to life in simple storytelling language. Generate ${count} facts about ${topic}.\n${rules}\nFocus on the story, the emotion, or the surprising twist — not scholarly analysis.`;
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
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as { topic: string; category: string; facts: string[] };

    return NextResponse.json({
      deity: parsed.topic ?? topic,
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      imageUrl: "",
      wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic)}`,
      category: parsed.category ?? category,
      source: "Gemini AI",
      total_facts_available: parsed.facts?.length ?? 0,
    });
  } catch (err) {
    console.error("[gemini/facts]", err);
    return NextResponse.json({ error: "Failed to generate facts", detail: String(err) }, { status: 500 });
  }
}
