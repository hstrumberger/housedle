/**
 * scripts/scrape-redfin.ts  (targets Realtor.com)
 *
 * Realtor.com is client-rendered and makes XHR calls to its search API,
 * so network response interception works — unlike Redfin (SSR) or Zillow
 * (heavy bot-detection).
 *
 * Flow:
 *   1. Visit Realtor.com homepage to establish session.
 *   2. For each city, navigate to /homes-for-sale/{city}_{state}/ and
 *      intercept responses from the internal search API.
 *   3. Parse listings (price, address, beds, baths, sqft, yearBuilt,
 *      lotSizeSqft, photos) from the intercepted JSON.
 *   4. Sort, cap at 30, write data/houses.ts.
 *
 * Usage:
 *   npx playwright install chromium   (first time only)
 *   npm run scrape                    # writes data/houses.ts
 *   npm run scrape -- --dry-run       # prints to stdout only
 */

import { chromium } from 'playwright-extra';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StealthPlugin = require('puppeteer-extra-plugin-stealth') as () => any;
import * as fs from 'fs';
import * as path from 'path';

chromium.use(StealthPlugin());

// ── helpers ───────────────────────────────────────────────────────────────────

function sleep(min: number, max: number) {
  return new Promise<void>((r) => setTimeout(r, min + Math.random() * (max - min)));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function n(v: unknown): number {
  const x = Number(v);
  return isFinite(x) ? x : 0;
}

// ── types ─────────────────────────────────────────────────────────────────────

interface Listing {
  actualPrice: number;
  address: string;
  city: string;
  state: string;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  lotSizeSqft: number;
  photos: string[];
}

// ── cities (diverse, no price filtering) ─────────────────────────────────────

const ALL_CITIES = shuffle([
  { city: 'Austin',       state: 'TX', slug: 'Austin_TX' },
  { city: 'Denver',       state: 'CO', slug: 'Denver_CO' },
  { city: 'Miami',        state: 'FL', slug: 'Miami_FL' },
  { city: 'Phoenix',      state: 'AZ', slug: 'Phoenix_AZ' },
  { city: 'Nashville',    state: 'TN', slug: 'Nashville_TN' },
  { city: 'Charlotte',    state: 'NC', slug: 'Charlotte_NC' },
  { city: 'Atlanta',      state: 'GA', slug: 'Atlanta_GA' },
  { city: 'Portland',     state: 'OR', slug: 'Portland_OR' },
  { city: 'Seattle',      state: 'WA', slug: 'Seattle_WA' },
  { city: 'Minneapolis',  state: 'MN', slug: 'Minneapolis_MN' },
  { city: 'Detroit',      state: 'MI', slug: 'Detroit_MI' },
  { city: 'Cleveland',    state: 'OH', slug: 'Cleveland_OH' },
  { city: 'Memphis',      state: 'TN', slug: 'Memphis_TN' },
  { city: 'Boston',       state: 'MA', slug: 'Boston_MA' },
  { city: 'Chicago',      state: 'IL', slug: 'Chicago_IL' },
  { city: 'Dallas',       state: 'TX', slug: 'Dallas_TX' },
  { city: 'Houston',      state: 'TX', slug: 'Houston_TX' },
  { city: 'Orlando',      state: 'FL', slug: 'Orlando_FL' },
  { city: 'Raleigh',      state: 'NC', slug: 'Raleigh_NC' },
  { city: 'Sacramento',   state: 'CA', slug: 'Sacramento_CA' },
  { city: 'Las Vegas',    state: 'NV', slug: 'Las-Vegas_NV' },
  { city: 'St. Louis',    state: 'MO', slug: 'Saint-Louis_MO' },
  { city: 'Columbus',     state: 'OH', slug: 'Columbus_OH' },
  { city: 'Indianapolis', state: 'IN', slug: 'Indianapolis_IN' },
  { city: 'Milwaukee',    state: 'WI', slug: 'Milwaukee_WI' },
]);

// ── parse a Realtor.com listing object ───────────────────────────────────────

function parseListing(raw: any, fallbackCity: string, fallbackState: string): Listing | null {
  // Price
  const price = n(raw?.list_price ?? raw?.price ?? raw?.listPrice);
  if (price < 10_000) return null;

  // Address
  const loc = raw?.location ?? raw?.address ?? {};
  const addr = loc?.address ?? loc;
  const street = String(
    addr?.line ?? addr?.street ?? addr?.streetAddress ?? raw?.streetAddress ?? ''
  ).trim();
  if (!street) return null;

  const city  = String(addr?.city  ?? loc?.city  ?? raw?.city  ?? fallbackCity).trim();
  const state = String(addr?.state_code ?? addr?.state ?? loc?.state_code ?? loc?.state ?? raw?.state ?? fallbackState).trim();

  // Property details
  const desc = raw?.description ?? raw;
  const beds  = n(desc?.beds ?? desc?.bedrooms ?? raw?.beds);
  const baths = n(desc?.baths_consolidated ?? desc?.baths_full_calc ?? desc?.baths ?? desc?.bathrooms ?? raw?.baths);
  const sqft  = n(desc?.sqft ?? desc?.living_sqft ?? desc?.livingArea ?? raw?.sqft);
  const yearBuilt   = n(desc?.year_built ?? desc?.yearBuilt ?? raw?.year_built ?? raw?.yearBuilt);
  const lotSizeSqft = n(desc?.lot_sqft ?? raw?.lot_sqft ?? raw?.lotSizeSqft);

  // Photos
  const photos: string[] = [];
  const photosArr: any[] = raw?.photos ?? raw?.photo_urls ?? [];
  for (const p of photosArr) {
    const href = p?.href ?? p?.url ?? (typeof p === 'string' ? p : '');
    if (href && href.startsWith('http')) {
      // Upscale to large format
      photos.push(href.replace(/-s\d+\b/, '-s960').replace(/-m\d+\b/, '-s960'));
    }
    if (photos.length >= 2) break;
  }
  // Also try primary_photo
  if (photos.length < 2) {
    const primary = raw?.primary_photo?.href ?? raw?.primaryPhoto?.href ?? raw?.thumbnail_url ?? '';
    if (primary && primary.startsWith('http') && !photos.includes(primary)) {
      photos.push(primary);
    }
  }

  return { actualPrice: price, address: street, city, state, beds, baths, sqft, yearBuilt, lotSizeSqft, photos };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`[scrape] Starting${dryRun ? ' (dry-run)' : ''}…`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const page = await context.newPage();

    // ── Homepage ─────────────────────────────────────────────────────────────
    console.log('[scrape] Loading Realtor.com homepage…');
    await page.goto('https://www.realtor.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await sleep(2000, 3500);

    // ── Collect listings ──────────────────────────────────────────────────────
    const listings: Listing[] = [];
    const TARGET = 30;
    const PER_CITY = 3;

    for (const loc of ALL_CITIES) {
      if (listings.length >= TARGET + 9) break;

      const searchUrl = `https://www.realtor.com/homes-for-sale/${loc.slug}/`;
      console.log(`\n[scrape] ${loc.city}, ${loc.state} → ${searchUrl}`);

      // Collect intercepted XHR responses
      const captured: any[][] = [];

      const onResponse = async (response: any) => {
        const url: string = response.url();
        const ct: string = response.headers()['content-type'] ?? '';
        if (
          !ct.includes('json') ||
          (!url.includes('/api/') && !url.includes('graphql') && !url.includes('search'))
        ) return;
        if (response.status() !== 200) return;

        try {
          const text = await response.text();
          const json = JSON.parse(text);
          // Realtor.com search APIs typically nest results in .data.home_search.results
          // or .data.homes, or directly as .results, or .properties
          const homes: any[] =
            json?.data?.home_search?.results ??
            json?.data?.homes ??
            json?.results ??
            json?.properties ??
            json?.data?.results ??
            json?.homes ??
            [];
          if (Array.isArray(homes) && homes.length > 0) {
            captured.push(homes);
          }
        } catch {
          // not JSON or unexpected format
        }
      };

      page.on('response', onResponse);

      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // Wait for XHR calls to complete
        await sleep(6000, 9000);
      } catch (e) {
        console.warn(`  ⚠ navigation failed: ${e}`);
        page.off('response', onResponse);
        continue;
      }

      page.off('response', onResponse);

      if (captured.length === 0) {
        console.warn(`  ⚠ no search API responses captured — site may have changed or bot-blocked`);
        continue;
      }

      // Flatten all captured results
      const allHomes = captured.flat();
      console.log(`  intercepted ${allHomes.length} raw listing objects`);

      let taken = 0;
      for (const raw of allHomes) {
        if (taken >= PER_CITY) break;
        const listing = parseListing(raw, loc.city, loc.state);
        if (!listing) continue;
        listings.push(listing);
        taken++;
      }
      console.log(`  kept ${taken} (total: ${listings.length})`);

      await sleep(1500, 3000);
    }

    if (listings.length === 0) {
      throw new Error(
        'No listings collected.\n' +
        'Realtor.com may have changed their API or blocked the request.\n' +
        'Run with --dry-run and check the interception warnings above.'
      );
    }

    // ── Sort, cap, write ──────────────────────────────────────────────────────
    listings.sort((a, b) => a.actualPrice - b.actualPrice);
    const final = listings.slice(0, TARGET);

    if (final.length < TARGET) {
      console.warn(`\nWARNING: only ${final.length}/${TARGET} listings collected.`);
    }

    const timestamp = new Date().toISOString();
    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const lines: string[] = [
      `import { HouseListing } from '@/types';`,
      ``,
      `// SERVER-ONLY — never import this from client components`,
      `// Generated by scripts/scrape-redfin.ts at ${timestamp}`,
      `export const houses: HouseListing[] = [`,
    ];

    final.forEach((h, i) => {
      const id = `house-${String(i + 1).padStart(3, '0')}`;
      lines.push(`  {`);
      lines.push(`    id: '${id}',`);
      lines.push(`    actualPrice: ${h.actualPrice},`);
      lines.push(`    address: '${esc(h.address)}',`);
      lines.push(`    city: '${esc(h.city)}',`);
      lines.push(`    state: '${h.state}',`);
      lines.push(`    beds: ${h.beds},`);
      lines.push(`    baths: ${h.baths},`);
      lines.push(`    sqft: ${h.sqft},`);
      lines.push(`    yearBuilt: ${h.yearBuilt},`);
      lines.push(`    lotSizeSqft: ${h.lotSizeSqft},`);
      lines.push(`    photos: [`);
      h.photos.forEach((p) => lines.push(`      '${p}',`));
      lines.push(`    ],`);
      lines.push(`  },`);
    });

    lines.push(`];`);
    lines.push(``);
    lines.push(`export const allHouseIds = houses.map((h) => h.id);`);
    lines.push(``);

    const content = lines.join('\n');

    if (dryRun) {
      console.log('\n─── DRY RUN OUTPUT ───\n');
      console.log(content);
      console.log('\n─── END ───');
    } else {
      const outPath = path.resolve('data/houses.ts');
      fs.writeFileSync(outPath, content, 'utf8');
      console.log(`\n[scrape] ✓ Wrote ${final.length} listings to ${outPath}`);
    }
    console.log('[scrape] Done.');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('[scrape] FATAL:', e);
  process.exit(1);
});
