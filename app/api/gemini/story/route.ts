import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const topic    = searchParams.get("topic")    ?? "";
  const category = searchParams.get("category") ?? "Short Stories";
  const excerpt  = searchParams.get("excerpt")  ?? "";

  if (!topic || !excerpt) {
    return NextResponse.json({ error: "Missing topic or excerpt" }, { status: 400 });
  }

  const isMoral = category === "Moral Stories";

  const prompt = isMoral
    ? `You are a master Indian storyteller. Expand the following opening into a complete moral story rooted in Indian tradition — draw from Panchatantra, Akbar-Birbal, Tenali Raman, Jataka tales, Indian mythology (Ramayana, Mahabharata, Puranas), or classic Indian folk tales.

Title: ${topic}
Opening excerpt: ${excerpt}

Write the FULL story following these rules:
- 500-700 words total
- Write ENTIRELY in Hindi (Devanagari script). Do not use any English words at all.
- Use simple, conversational Hindi that a common Indian person of any age can read and enjoy — like a nani telling a bedtime story
- Rooted in Indian culture, values, and storytelling tradition
- Vivid descriptions and engaging dialogue where appropriate
- A satisfying, clear ending
- End the story with a new line that starts exactly with "नैतिक शिक्षा: " followed by the lesson in Hindi
- Write in flowing paragraphs — no bullet points, no headers
- Do NOT copy the opening word for word. Continue naturally from where it left off.
- Do NOT use Western, Greek, Chinese, or non-Indian story traditions.
- Return ONLY the story text, nothing else.`
    : `You are a master Indian storyteller. Expand the following opening into a complete short story rooted in Indian tradition — draw from Indian mythology (Ramayana, Mahabharata, Puranas), Panchatantra, Akbar-Birbal tales, Tenali Raman stories, Jataka tales, or classic Indian folk stories.

Title: ${topic}
Opening excerpt: ${excerpt}

Write the FULL story following these rules:
- 500-700 words total
- Write ENTIRELY in Hindi (Devanagari script). Do not use any English words at all.
- Use simple, conversational Hindi that a common Indian person of any age can read and enjoy — like a dadi telling a story by the fire
- Rooted in Indian culture, values, and storytelling tradition
- Vivid descriptions and engaging dialogue where appropriate
- A satisfying ending that feels complete
- Write in flowing paragraphs — no bullet points, no headers
- Do NOT copy the opening word for word. Continue naturally from where it left off.
- Do NOT use Western, Greek, Chinese, or non-Indian story traditions.
- Return ONLY the story text, nothing else.`;

  try {
    const model  = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
    const result = await model.generateContent(prompt);
    const story  = result.response.text().trim();
    return NextResponse.json({ story, topic, category });
  } catch (err) {
    console.error("[gemini/story]", err);
    return NextResponse.json({ error: "Failed to generate story" }, { status: 500 });
  }
}
