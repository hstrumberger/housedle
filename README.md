# Housedle

A daily house price guessing game. Five real listings sourced from Craigslist, one chance per house, same houses for everyone worldwide each day — like Wordle, but for real estate.

## How it works

Each day you're shown 5 house listings one at a time: photos, address, beds/baths, square footage. Drag the logarithmic slider (or type directly) to set your price guess, submit, and find out how close you were. After all 5 houses you get a shareable score card.

Prices are never sent to the browser until after a guess is submitted. The scoring backend validates every guess server-side.

## Scoring

Score per house uses exponential decay on percentage error, so the scale is fair across a $135K bungalow and a $3M mansion:

```
score = 1000 × e^(−k × |percentOff|)     where k = ln(2) / 0.25
```

| Error | Score |
|-------|-------|
| 0% | 1000 |
| 10% | ~760 |
| 25% | 500 |
| 50% | ~250 |

**Emoji tiers:** 🟩 ≥900 · 🟨 ≥700 · 🟧 ≥500 · 🟥 ≥300 · ⬛ <300

Maximum total score: **5,000**.

## Tech stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** for styling
- **Framer Motion** for animations
- **Playwright** for the Craigslist scraper
- No database — house data lives in a server-only static file, game state in `localStorage`

## Project structure

```
app/
  api/
    daily/route.ts      GET  — returns today's 5 houses (no prices)
    guess/route.ts      POST — validates guess, returns actual price + score
  layout.tsx
  page.tsx
components/game/
  GameShell.tsx         Stateful orchestrator (FSM)
  HouseCard.tsx         Listing details display
  PhotoCarousel.tsx     Swipeable photo gallery
  GuessInput.tsx        Logarithmic slider + text input
  RevealPanel.tsx       Animated post-guess reveal
  ScoreBar.tsx          Animated accuracy bar
  ProgressDots.tsx      5-dot progress indicator
  ResultsSummary.tsx    Final score + share button
data/
  houses.ts             5 listings with prices — server-only, never bundled to client
scripts/
  scrape-craigslist.ts  Playwright scraper that refreshes data/houses.ts
lib/
  dailySeed.ts          Date → deterministic house selection (mulberry32 PRNG)
  scoring.ts            Pure scoring function + emoji tiers
  gameState.ts          localStorage read/write with schema versioning
  share.ts              Wordle-style share text builder
  formatters.ts         Price/number formatting helpers
types/
  index.ts              All TypeScript interfaces
```

## Running locally

```bash
npm install
npx playwright install chromium   # first time only
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To refresh the house listings:

```bash
npm run scrape           # writes data/houses.ts from live Craigslist listings
npm run scrape -- --dry-run  # preview without writing
```

To verify the API:

```bash
# Today's 5 houses — confirm no actualPrice field
curl http://localhost:3000/api/daily

# Submit a guess — returns actualPrice, score, percentOff, direction
curl -X POST http://localhost:3000/api/guess \
  -H "Content-Type: application/json" \
  -d '{"houseId":"house-001","gameDate":"2026-03-19","guessedPrice":300000}'
```

## How daily selection works

A [mulberry32](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c) seeded PRNG is seeded with the game number (days since 2025-01-01). The same shuffle runs identically in Node and the browser, so the server can re-derive today's house set on every request without storing state.

## Price security

`data/houses.ts` is imported only in `app/api/` routes. It is never referenced from any component or client-side lib. The build confirms it doesn't appear in the client bundle. Run this to verify:

```bash
grep -r "from.*data/houses" components/ lib/ app/page.tsx
# should return nothing
```

## Deploying

The app has no database or environment variables. Deploy to Vercel by importing the repo — it works out of the box.

```bash
npm run build   # verify locally before deploying
```
