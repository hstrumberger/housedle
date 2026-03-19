/**
 * Dumps the raw structure of one GIS result + one detail API result.
 * Run: npx tsx scripts/discover-redfin-api.ts
 */
import { chromium } from 'playwright-extra';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StealthPlugin = require('puppeteer-extra-plugin-stealth') as () => any;
import type { Page } from 'playwright';

chromium.use(StealthPlugin());

async function browserFetch(page: Page, url: string) {
  return page.evaluate(async (u: string) => {
    const res = await fetch(u, {
      credentials: 'include',
      headers: { accept: '*/*', 'x-requested-with': 'XMLHttpRequest' },
    });
    return { status: res.status, text: await res.text() };
  }, url);
}

function rfJson(text: string): any {
  return JSON.parse(text.replace(/^\s*{}\s*&&\s*/, ''));
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  await page.goto('https://www.redfin.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // ── GIS search for Austin city (region_id=17409) ──
  const { status, text } = await browserFetch(
    page,
    'https://www.redfin.com/stingray/api/gis?al=1&num_homes=3&region_id=17409&region_type=6&sf=1,2,3,5,6,7&status=1&uipt=1,2,3,4,5,6&v=8'
  );
  console.log(`GIS status: ${status}`);

  const json = rfJson(text);
  const homes: any[] = json?.payload?.homes ?? [];
  console.log(`Homes count: ${homes.length}`);

  if (homes.length > 0) {
    const h = homes[0];
    console.log('\n── First home raw keys ──');
    console.log(Object.keys(h).join(', '));

    console.log('\n── Price ──');
    console.log(JSON.stringify(h.price));

    console.log('\n── Address ──');
    console.log(JSON.stringify(h.streetLine));
    console.log(JSON.stringify(h.cityStateZip));

    console.log('\n── Stats ──');
    console.log('beds:', h.beds, '  baths:', h.baths);
    console.log('sqFt:', JSON.stringify(h.sqFt));
    console.log('yearBuilt:', h.yearBuilt, '  yearBlt:', h.yearBlt);
    console.log('lotSize:', JSON.stringify(h.lotSize));
    console.log('lotSqFt:', h.lotSqFt);

    console.log('\n── URL / IDs ──');
    console.log('url:', h.url);
    console.log('id:', h.id);
    console.log('propertyId:', h.propertyId);
    console.log('mlsId:', JSON.stringify(h.mlsId));

    console.log('\n── Photos ──');
    console.log('photoInfo keys:', h.photoInfo ? Object.keys(h.photoInfo) : 'null');
    console.log('photos field type:', typeof h.photos, Array.isArray(h.photos) ? 'array len=' + h.photos.length : '');
    console.log('photos[0]:', JSON.stringify(h.photos?.[0])?.slice(0, 600));
    console.log('additionalPhotosInfo:', JSON.stringify(h.additionalPhotosInfo)?.slice(0, 300));

    // ── Detail API ──
    const urlStr: string = h.url ?? '';
    const parts = urlStr.replace(/\?.*/, '').split('/').filter(Boolean);
    const propId = parts[parts.length - 1] ?? String(h.id ?? '');
    console.log('\n── Detail API call ──');
    console.log('propertyId (from URL last segment):', propId);

    const { status: ds, text: dt } = await browserFetch(
      page,
      `https://www.redfin.com/stingray/api/home/details/aboveTheFold?propertyId=${propId}&accessLevel=1`
    );
    console.log('detail status:', ds);
    if (ds === 200) {
      const dp = rfJson(dt)?.payload;
      console.log('detail payload keys:', dp ? Object.keys(dp).join(', ') : 'null');
      console.log('publicRecordsInfo:', JSON.stringify(dp?.publicRecordsInfo)?.slice(0, 400));
      console.log('photos (top-level):', JSON.stringify(dp?.photos)?.slice(0, 400));
      console.log('propertyHistoryInfo:', JSON.stringify(dp?.propertyHistoryInfo)?.slice(0, 200));
    } else {
      console.log('detail body:', dt.slice(0, 300));
    }
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
