# BrewLog

A personal AI-powered coffee brew diary and advisor — built as a mobile-first PWA for specialty coffee enthusiasts.

> Tracks brew sessions, analyses coffee bags via camera, recommends recipes, and learns your taste preferences over time.

---

## What it does

- **Brew diary** — log every session with dose, ratio, grind, temperature, method, and a star rating
- **AI bag analysis** — photograph a coffee bag and Claude extracts roaster, origin, process, and variety automatically
- **Recipe recommendation** — AI generates a personalised brew recipe based on the coffee, your equipment, and your brew history
- **Match Finder** — scan or manually enter a coffee to get a personalised match score based on taste profile
- **Explore / AMA** — chat with a specialty coffee connoisseur AI; ask about methods, origins, science, championships
- **Research Insights** — weekly automated research agent surfaces new specialty coffee knowledge into the app
- **Coffee alerts webhook** — external systems can POST new coffees to watch via webhook

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | Firebase Firestore |
| Storage | Firebase Storage |
| Auth | Firebase Auth |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Hosting | Vercel |
| Platform | iPhone PWA (add to home screen) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App                       │
│                                                      │
│  /app          — pages (home, brew, coffees,         │
│                          match, explore, taste)      │
│  /api          — route handlers (Claude, Firebase)   │
│  /components   — UI, layout, flow steps              │
│  /lib          — Claude prompts, Firebase, knowledge │
│  /store        — Zustand state (brew flow)           │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   Firestore    Firebase       Anthropic
   (sessions,   Storage        Claude API
   coffees,     (bag photos)   (vision, chat,
   knowledge)                   recommendations)
```

### Key API routes

| Route | Purpose |
|---|---|
| `POST /api/analyze-bag` | Claude vision → extract coffee details from photo |
| `POST /api/recommend` | Generate brew recipe for a specific coffee |
| `POST /api/match` | Score a coffee against user taste profile |
| `POST /api/explore` | AMA chat with coffee connoisseur AI |
| `POST /api/research` | Research agent — runs weekly via Vercel cron |
| `POST /api/upload` | Upload bag photo to Firebase Storage |
| `GET /api/hints` | Coffee knowledge hints for loading screens |
| `GET /api/insights` | Research insights from Firestore |
| `POST /api/webhooks/coffee-alert` | Receive external coffee alerts |

---

## AI design

### Bag analysis
Claude vision reads a coffee bag photo and returns structured JSON: roaster, coffee name, origin, region, process, variety, roast level, roast date, tasting notes, altitude.

### Recipe recommendation
A full user profile is baked into the system prompt — equipment, grinder settings, water chemistry, taste preferences, and historical brew data. Claude returns a step-by-step pour sequence tailored to the specific coffee and method.

### Match scoring
Claude scores a coffee 0–100 against the user's taste profile and brew history, with reasoning. Considers origin, process, variety, roast level, tasting notes, and roast freshness.

### Explore / AMA
Deep specialty coffee expert persona. Loads last 10 research insights and 5 coffee alerts from Firestore as dynamic context. Responses are kept concise — no filler, direct answers.

### Research agent
Runs every Monday via Vercel cron. Uses Claude with `web_search_20250305` tool to find new specialty coffee knowledge. Saves 3–5 insights, knowledge hints, and news items to Firestore. Falls back to training knowledge if web search is unavailable.

---

## Notable technical decisions

### Firebase Storage image upload
Standard approaches (`getSignedUrl`, `makePublic`) fail on newer `*.firebasestorage.app` buckets. The solution:

1. Upload file via Firebase Admin SDK
2. Generate a UUID download token
3. PATCH the file metadata via Firebase Storage REST API to attach the token
4. Construct a permanent URL: `https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={uuid}`

No expiry, no CORS issues, no permission complexity. All bag photo `<img>` tags use plain HTML — Next.js `<Image>` cannot handle blob URLs or this URL format.

### Vercel cron secret
When setting env vars via Vercel CLI, use `printf` to avoid trailing whitespace (which breaks HTTP header validation):
```bash
printf "your-secret" | vercel env add CRON_SECRET production
```

---

## Setup

### Prerequisites
- Node.js 18+
- Firebase project (Firestore + Storage + Auth enabled)
- Anthropic API key
- Vercel account

### Install

```bash
npm install
cp .env.example .env.local
# Fill in .env.local with your values
npm run dev
```

### Personalise for your setup

1. Set `USER_DISPLAY_NAME` and `USER_LOCATION` in `.env.local`
2. Update your equipment, grind settings, and taste profile in:
   - `src/lib/claude/recommend.ts` — brew recipe system prompt
   - `src/app/api/explore/route.ts` — AMA chat system prompt
   - `src/app/api/match/route.ts` — match scoring baseline
3. Update `CLAUDE.md` with your own profile for Claude Code context

### Firebase

1. Create a Firebase project
2. Enable Firestore, Storage, and Authentication
3. Create a custom Firestore database and note the database ID
4. Generate a service account key for the Admin SDK
5. Add all config values to `.env.local`

### Seed initial knowledge

```bash
node scripts/seed-insights.mjs
```

### Deploy

```bash
npx vercel deploy --prod
```

---

## Vercel cron

Weekly research agent — every Monday at 06:00 UTC (`vercel.json`):

```json
{ "crons": [{ "path": "/api/research", "schedule": "0 6 * * 1" }] }
```

---

## Firestore structure

```
/users/{uid}
  /sessions/{sessionId}     — brew sessions
  /coffees/{coffeeId}       — coffee library

/knowledge/hints            — rotating coffee knowledge hints
/knowledge/insights         — research insights (weekly)
/knowledge/news             — coffee news feed

/coffeeAlerts/{id}          — incoming alerts from webhook
```

---

## Screenshots

> Add screenshots here — home screen, brew flow, match finder, explore chat

---

## Design language

- **Background:** `#0A0A0A` pure black
- **Surfaces:** `#141414` / `#1E1E1E`
- **Accent:** `#F0EDE8` warm near-white
- **Fonts:** DM Serif Display (headlines) · Inter (body) · JetBrains Mono (numbers)
- **Style:** Editorial, content-first, mobile-first

---

## License

MIT
