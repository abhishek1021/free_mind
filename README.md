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
- **Channels tab** — follow public Telegram channels; posts fetched live via GramJS MTProto
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
| Telegram | GramJS (`telegram` npm package) — MTProto API, session string auth |
| PWA | Web App Manifest + Service Worker |
| Hosting | AWS Amplify + CloudFront |

---

## Getting started locally

### Prerequisites
- Node.js 18+
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com)
- (Optional) A Telegram account for the Channels tab

### Setup

```bash
git clone https://github.com/abhishek1021/free_mind.git
cd free_mind
npm install
```

Create a `.env.local` file in the project root:

```
GEMINI_API_KEY=your_gemini_api_key_here

# Optional — only needed for the Telegram Channels tab
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_SESSION=your_session_string
```

#### Setting up Telegram (one-time)

1. Go to [my.telegram.org](https://my.telegram.org) → Log in → **API development tools** → Create an app
2. Copy `api_id` and `api_hash` into `.env.local`
3. Run the auth script to get your session string:
   ```bash
   node scripts/telegram-auth.mjs
   ```
4. Enter your phone number, OTP, and 2FA password (if any)
5. Copy the printed `TELEGRAM_SESSION=...` line into `.env.local`
6. Edit `lib/telegram-channels.ts` to add the public Telegram channels you want to follow

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
│   │   ├── gemini/facts/route.ts      # Gemini AI content generation
│   │   ├── telegram/posts/route.ts    # Telegram GramJS API route
│   │   └── image-proxy/route.ts       # Image proxy (unused in prod)
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Feed.tsx                       # Main app shell — Feed, Explore, Saved, Channels tabs
│   └── CardView.tsx                   # Swipeable card with image + fact
├── lib/
│   ├── api.ts                         # API helpers, category definitions, types
│   └── telegram-channels.ts           # Telegram channel list (edit to add your channels)
├── scripts/
│   └── telegram-auth.mjs              # One-time script to get Telegram session string
├── public/
│   ├── manifest.json                  # PWA manifest
│   ├── sw.js                          # Service worker
│   ├── icon-192.png
│   └── icon-512.png
└── amplify.yml                        # AWS Amplify build configuration
```

---

## Deploying to AWS Amplify

1. Push the repo to GitHub
2. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify) → New app → Host web app
3. Connect the GitHub repository, select the `main` branch
4. Under **Hosting → Environment variables**, add:
   ```
   GEMINI_API_KEY      = your_gemini_api_key_here
   TELEGRAM_API_ID     = your_api_id          (if using Channels tab)
   TELEGRAM_API_HASH   = your_api_hash        (if using Channels tab)
   TELEGRAM_SESSION    = your_session_string  (if using Channels tab)
   ```
5. Click **Save and deploy**

The `amplify.yml` in the project root handles the build configuration and ensures the API key is available to server-side Lambda functions at runtime.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for content generation |
| `TELEGRAM_API_ID` | Channels tab | App ID from my.telegram.org |
| `TELEGRAM_API_HASH` | Channels tab | App hash from my.telegram.org |
| `TELEGRAM_SESSION` | Channels tab | Session string generated by `scripts/telegram-auth.mjs` |

---

## License

MIT
