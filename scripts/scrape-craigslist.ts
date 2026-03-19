/**
 * scripts/scrape-craigslist.ts
 *
 * Scrapes real-estate-for-sale listings from Craigslist.
 * Craigslist has minimal bot-detection, making it reliably scrapeable.
 *
 * Flow:
 *   1. For each city, navigate to the Craigslist for-sale search page.
 *   2. Collect listing detail URLs from the results.
 *   3. Visit each detail page: extract price, address, beds, baths, sqft, photos.
 *   4. Sort by price ascending, cap at 30, write data/houses.ts.
 *
 * Usage:
 *   npm run scrape               # writes data/houses.ts
 *   npm run scrape -- --dry-run  # prints to stdout only
 */

import { chromium } from 'playwright-extra';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StealthPlugin = require('puppeteer-extra-plugin-stealth') as () => any;
import * as fs from 'fs';
import * as path from 'path';

chromium.use(StealthPlugin());

// ── helpers ───────────────────────────────────────────────────────────────────

function sleep(min: number, max: number) {
  return new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));
}

function n(v: unknown): number {
  const x = Number(String(v).replace(/[$,]/g, ''));
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

// ── cities ────────────────────────────────────────────────────────────────────

const CITIES = [
  { name: 'Austin',        state: 'TX', domain: 'austin' },
  { name: 'Denver',        state: 'CO', domain: 'denver' },
  { name: 'Nashville',     state: 'TN', domain: 'nashville' },
  { name: 'Cleveland',     state: 'OH', domain: 'cleveland' },
  { name: 'Pittsburgh',    state: 'PA', domain: 'pittsburgh' },
  { name: 'St. Louis',     state: 'MO', domain: 'stlouis' },
  { name: 'Indianapolis',  state: 'IN', domain: 'indianapolis' },
  { name: 'Kansas City',   state: 'MO', domain: 'kansascity' },
  { name: 'Columbus',      state: 'OH', domain: 'columbus' },
  { name: 'Charlotte',     state: 'NC', domain: 'charlotte' },
  { name: 'Memphis',          state: 'TN', domain: 'memphis' },
  { name: 'Louisville',       state: 'KY', domain: 'louisville' },
  { name: 'Richmond',         state: 'VA', domain: 'richmond' },
  { name: 'Knoxville',        state: 'TN', domain: 'knoxville' },
  { name: 'Lexington',        state: 'KY', domain: 'lexington' },
  { name: 'Chattanooga',      state: 'TN', domain: 'chattanooga' },
  { name: 'Little Rock',      state: 'AR', domain: 'littlerock' },
  { name: 'Baton Rouge',      state: 'LA', domain: 'batonrouge' },
  { name: 'Birmingham',       state: 'AL', domain: 'birmingham' },
  { name: 'Jackson',          state: 'MS', domain: 'jackson' },
  { name: 'Albuquerque',      state: 'NM', domain: 'albuquerque' },
  { name: 'El Paso',          state: 'TX', domain: 'elpaso' },
  { name: 'Colorado Springs', state: 'CO', domain: 'cosprings' },
  { name: 'Wichita',          state: 'KS', domain: 'wichita' },
  { name: 'Des Moines',       state: 'IA', domain: 'desmoines' },
  { name: 'Raleigh',          state: 'NC', domain: 'raleigh' },
  { name: 'Cincinnati',       state: 'OH', domain: 'cincinnati' },
  { name: 'Tulsa',            state: 'OK', domain: 'tulsa' },
  { name: 'Tampa',            state: 'FL', domain: 'tampa' },
  { name: 'Milwaukee',        state: 'WI', domain: 'milwaukee' },
];

// ── extract photos from listing page ─────────────────────────────────────────

async function extractPhotos(page: import('playwright').Page): Promise<string[]> {
  // Try anchor tags in thumb strip (old + new Craigslist)
  const fromAnchors = await page.$$eval(
    '#thumbs a, .swipe-wrap a, div.gallery a',
    els => els.map(el => (el as HTMLAnchorElement).href)
  ).catch(() => [] as string[]);

  const photos: string[] = fromAnchors
    .filter(u => u && u.startsWith('http'))
    .map(u => u.replace(/_\d+x\d+[a-z]?\./, '_1200x900.'));

  if (photos.length > 0) return photos;

  // Fallback: img src tags
  const fromImgs = await page.$$eval(
    '#thumbs img, .swipe-wrap img, div.gallery img',
    imgs => imgs.map(img => (img as HTMLImageElement).src)
  ).catch(() => [] as string[]);

  return fromImgs
    .filter(u => u && u.startsWith('http') && !u.includes('placeholder'))
    .map(u => u.replace(/_\d+x\d+[a-z]?\./, '_1200x900.'));
}

// ── parse housing attributes (beds/baths/sqft) ────────────────────────────────

function parseAttrs(texts: string[]): { beds: number; baths: number; sqft: number } {
  let beds = 0, baths = 0, sqft = 0;
  for (const t of texts) {
    const br = t.match(/(\d+)\s*[Bb][Rr]/);
    if (br) beds = parseInt(br[1]);
    const ba = t.match(/(\d+\.?\d*)\s*[Bb][Aa]/);
    if (ba) baths = parseFloat(ba[1]);
    const ft = t.match(/([\d,]+)\s*ft[²2]/);
    if (ft) sqft = parseInt(ft[1].replace(/,/g, ''));
  }
  return { beds, baths, sqft };
}

// ── collect listing URLs from search results page ─────────────────────────────

async function collectListingUrls(page: import('playwright').Page): Promise<string[]> {
  // Look for detail page anchors — works with both old and new Craigslist HTML
  const urls = await page.$$eval('a', els => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const el of els) {
      const href = (el as HTMLAnchorElement).href;
      // Match /rea/d/ (broker) or /reo/d/ (by-owner) detail pages
      if (href && /craigslist\.org\/(rea|reo)\/d\//.test(href) && !seen.has(href)) {
        seen.add(href);
        result.push(href);
        if (result.length >= 10) break;
      }
    }
    return result;
  }).catch(() => [] as string[]);
  return urls;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`[scrape] Starting Craigslist scraper${dryRun ? ' (dry-run)' : ''}...`);

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

    const listings: Listing[] = [];
    const TARGET = 5;
    const PER_CITY = 1; // one listing per city; move on immediately after finding one valid listing

    const visitedUrls = new Set<string>();

    // Shuffle so each run picks a different geographic mix
    const shuffledCities = [...CITIES].sort(() => Math.random() - 0.5);

    for (const city of shuffledCities) {
      if (listings.length >= TARGET) break;

      console.log(`\n[scrape] ${city.name}, ${city.state}`);

      // Try both section codes; reo (by-owner) often has more listings
      let listingUrls: string[] = [];
      for (const section of ['rea', 'reo']) {
        const searchUrl = `https://${city.domain}.craigslist.org/search/${section}`;
        try {
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
          // Wait for network idle to allow React-rendered pages to populate
          await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        } catch (e) {
          console.warn(`  ⚠ ${section} page failed: ${e}`);
          continue;
        }
        const found = await collectListingUrls(page);
        for (const u of found) {
          if (!visitedUrls.has(u) && !listingUrls.includes(u)) listingUrls.push(u);
        }
        if (listingUrls.length >= 6) break;
      }

      console.log(`  found ${listingUrls.length} unique listing URLs`);
      if (listingUrls.length === 0) {
        console.warn(`  ⚠ no listings found — skipping`);
        continue;
      }

      let taken = 0;
      for (const url of listingUrls) {
        if (taken >= PER_CITY || listings.length >= TARGET) break;

        visitedUrls.add(url);
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await sleep(700, 1300);

          // Price
          const priceText = await page.$eval(
            'span.price, h2.postingtitle .price, .postingtitletext span.price',
            el => el.textContent?.trim() ?? ''
          ).catch(() => '');
          const price = n(priceText);
          if (price < 50_000) {
            console.log(`  skip: price=${priceText}`);
            continue;
          }

          // Address — prefer structured map address, fall back to title
          // The .mapaddress div may contain a "google map" link; use only the text node
          const mapAddress = await page.$eval(
            '.mapaddress',
            el => {
              const clone = el.cloneNode(true) as Element;
              clone.querySelectorAll('a').forEach(a => a.remove());
              return clone.textContent?.trim() ?? '';
            }
          ).catch(() => '');

          const titleText = await page.$eval(
            'span.postingtitletext, h2.postingtitle',
            el => el.textContent?.trim() ?? ''
          ).catch(() => '');

          // Clean title: strip price, leading slashes, and trailing " near X" suffix
          const cleanTitle = titleText
            .replace(/\$[\d,]+/g, '')
            .replace(/^\s*[\/\-]\s*/, '')
            .replace(/\s*near\s+.{0,40}$/, '')
            .trim();

          const rawAddress = mapAddress || cleanTitle || 'Address not listed';
          // Validate: real address starts with street number, not sqft/BR descriptions
          const looksLikeAddr = rawAddress.length >= 6 &&
            (/^\d+\s+[A-Za-z]/.test(rawAddress) ||   // "123 Main St"
             /^(N|S|E|W|NE|NW|SE|SW)\s+\d/i.test(rawAddress) ||
             /^(Pa |Hwy |Rte |Route |US |-?\d+ Hwy)/i.test(rawAddress)) &&
            !/^\d+\s*(br|ba|ft)/i.test(rawAddress) &&  // reject "3br - ..."
            !/^\d+ft/i.test(rawAddress);               // reject "1200ft2 - ..."
          const address = (looksLikeAddr ? rawAddress : `${city.name} area listing`)
            .slice(0, 120);

          // Deduplicate by address
          const normAddr = address.toLowerCase().replace(/\s+/g, ' ').trim();
          if (listings.some(l => l.address.toLowerCase().replace(/\s+/g, ' ').trim() === normAddr)) {
            console.log(`  skip: duplicate address`);
            continue;
          }

          // Attributes
          const attrTexts = await page.$$eval(
            '.attrgroup span, .mapAndAttrs .attrgroup span, .attrgroup b, .housing',
            els => els.map(el => el.textContent?.trim() ?? '')
          ).catch(() => [] as string[]);
          const { beds, baths, sqft } = parseAttrs(attrTexts);

          // Photos
          const photos = await extractPhotos(page);

          // Quality gate: require photos and a residential listing (beds ≥ 1)
          if (photos.length === 0) {
            console.log(`  skip: no photos`);
            continue;
          }
          if (beds < 1) {
            console.log(`  skip: beds=${beds} (not residential)`);
            continue;
          }

          const listing: Listing = {
            actualPrice: price,
            address,
            city: city.name,
            state: city.state,
            beds,
            baths,
            sqft,
            yearBuilt: 0,
            lotSizeSqft: 0,
            photos,
          };

          listings.push(listing);
          taken++;
          console.log(
            `  ✓ $${price.toLocaleString()} | ${beds}br/${baths}ba | ${sqft}sqft | ` +
            `${photos.length} photos | ${address.slice(0, 50)}`
          );
        } catch (e) {
          console.warn(`  ⚠ listing page failed: ${e}`);
        }

        await sleep(800, 1800);
      }

      console.log(`  kept ${taken} (total: ${listings.length})`);
      await sleep(1500, 3000);
    }

    if (listings.length === 0) {
      throw new Error(
        'No listings collected.\n' +
        'Craigslist may have changed their HTML structure.\n' +
        'Run with --dry-run and check the warnings above.'
      );
    }

    // Sort, cap, write
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
      `// Generated by scripts/scrape-craigslist.ts at ${timestamp}`,
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
      h.photos.forEach(p => lines.push(`      '${esc(p)}',`));
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

main().catch(e => {
  console.error('[scrape] FATAL:', e);
  process.exit(1);
});
