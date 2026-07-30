# Free Mind

A mobile-first Progressive Web App (PWA) for mindful, intellectual scrolling. Free Mind delivers bite-sized facts, stories, riddles, and life hacks across a wide range of topics — powered by Google Gemini AI, with images sourced from Wikipedia.

Live at: **[freemind.abhishektripathi.info](https://freemind.abhishektripathi.info)**

---

## What it does

Instead of mindless social media scrolling, Free Mind gives you something worth reading. Every card is a short, plain-English insight generated fresh by Gemini AI — no fluff, no jargon.

### Content categories
| Category | What you get |
|---|---|
| ⚡ Mythology | Facts from Indian mythology — Krishna, Shiva, Hanuman and more |
| 🔬 Science | Mind-blowing science explained simply — black holes, DNA, the brain |
| 📜 History | Surprising historical facts — ancient civilisations, wars, empires |
| 💡 Life Hacks | Practical, immediately actionable tips on productivity, sleep, habits |
| 🧩 Riddles | Logic puzzles and brain teasers with answers |
| 🧠 Psychology | How the human mind works — biases, motivation, behaviour |
| 🌍 World Facts | Geography, animals, culture, natural wonders |
| 🏛️ Philosophy | Big ideas made simple — Stoicism, Existentialism, Eastern wisdom |
| 📖 Short Stories | Tales from Arabian Nights, Aesop, Norse legends, Silk Road |
| 🌿 Moral Stories | Panchatantra, Jataka Tales, Birbal, Sufi wisdom stories |

---

## Features

- **Mixed feed** — default feed shows one fact from a different random category per card, infinite scroll
- **Category feed** — tap any chip to load 15 facts from one category
- **Explore tab** — browse all categories and topics, auto-loads 10 more facts as you scroll
- **Swipe gestures** — swipe left/right to navigate cards on mobile
- **Bookmark** — save any card; persists across sessions via localStorage
- **Wikipedia images** — every card fetches a relevant image client-side from Wikipedia
- **PWA** — installable on Android/iOS via "Add to Home Screen" in Chrome
- **Simple English** — all Gemini prompts enforce plain language, no technical jargon

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion v12 |
| AI | Google Gemini (`gemini-3.5-flash-lite`) via `@google/generative-ai` |
| Images | Wikipedia REST API (client-side fetch) |
| PWA | Web App Manifest + Service Worker |
| Hosting | AWS Amplify + CloudFront |

---

## Getting started locally

### Prerequisites
- Node.js 18+
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com)

### Setup

```bash
git clone https://github.com/abhishek1021/free_mind.git
cd free_mind
npm install
```

Create a `.env.local` file in the project root:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project structure

```
free_mind/
├── app/
│   ├── api/
│   │   ├── gemini/facts/route.ts   # Gemini AI content generation
│   │   └── image-proxy/route.ts    # Image proxy (unused in prod)
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Feed.tsx                    # Main app shell — Feed, Explore, Saved tabs
│   └── CardView.tsx                # Swipeable card with image + fact
├── lib/
│   └── api.ts                      # API helpers, category definitions, types
├── public/
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service worker
│   ├── icon-192.png
│   └── icon-512.png
└── amplify.yml                     # AWS Amplify build configuration
```

---

## Deploying to AWS Amplify

1. Push the repo to GitHub
2. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify) → New app → Host web app
3. Connect the GitHub repository, select the `main` branch
4. Under **Hosting → Environment variables**, add:
   ```
   GEMINI_API_KEY = your_gemini_api_key_here
   ```
5. Click **Save and deploy**

The `amplify.yml` in the project root handles the build configuration and ensures the API key is available to server-side Lambda functions at runtime.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for content generation |

---

## License

MIT
