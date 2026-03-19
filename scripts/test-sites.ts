/**
 * Tests whether fetching Redfin zip pages via page.evaluate(fetch(...))
 * bypasses CloudFront, and whether GIS city results are returning the right cities.
 */
import { chromium } from 'playwright-extra';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StealthPlugin = require('puppeteer-extra-plugin-stealth') as () => any;
import type { Page } from 'playwright';
chromium.use(StealthPlugin());

async function browserFetchText(page: Page, url: string): Promise<{ status: number; text: string }> {
  return page.evaluate(async (u: string) => {
    const res = await fetch(u, { credentials: 'include', headers: { accept: 'text/html,*/*' } });
    return { status: res.status, text: await res.text() };
  }, url);
}

async function browserFetchJson(page: Page, url: string): Promise<{ status: number; text: string }> {
  return page.evaluate(async (u: string) => {
    const res = await fetch(u, { credentials: 'include', headers: { accept: '*/*', 'x-requested-with': 'XMLHttpRequest' } });
    return { status: res.status, text: await res.text() };
  }, url);
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  await page.goto('https://www.redfin.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  console.log('Session established (networkidle).');

  // Test 1: fetch zip page HTML via page.evaluate
  console.log('\n── Test 1: fetch /zipcode/78701 via page.evaluate ──');
  const { status, text } = await browserFetchText(page, 'https://www.redfin.com/zipcode/78701');
  console.log('status:', status);
  if (status === 200) {
    const match = text.match(/"regionId"\s*:\s*(\d+)/);
    console.log('regionId in HTML:', match?.[1] ?? 'not found');
    console.log('HTML snippet:', text.slice(0, 300).replace(/\s+/g, ' '));
  } else {
    console.log('blocked. snippet:', text.slice(0, 150).replace(/\s+/g, ' '));
  }

  // Test 2: verify GIS city ID actually returns the right city
  console.log('\n── Test 2: GIS region_id=17409 (should be Austin TX) ──');
  const { text: gis } = await browserFetchJson(page,
    'https://www.redfin.com/stingray/api/gis?al=1&num_homes=3&region_id=17409&region_type=6&sf=1,2,3,5,6,7&status=1&uipt=1&v=8'
  );
  const json = JSON.parse(gis.replace(/^\s*{}\s*&&\s*/, ''));
  const homes = json?.payload?.homes ?? [];
  homes.forEach((h: any) => {
    console.log(` → ${h.streetLine?.value ?? h.streetLine}, ${h.city}, ${h.state} $${h.price?.value?.toLocaleString()}`);
  });

  // Test 3: Try autocomplete API for "Austin TX"
  console.log('\n── Test 3: autocomplete "Austin TX" (stingray/do/) ──');
  const { status: acStatus, text: acText } = await browserFetchJson(page,
    'https://www.redfin.com/stingray/do/location-autocomplete?location=Austin+TX&v=2'
  );
  console.log('status:', acStatus);
  if (acStatus === 200) {
    const acJson = JSON.parse(acText.replace(/^\s*{}\s*&&\s*/, '').replace(/^\s*callback\(/, '').replace(/\)\s*$/, ''));
    const items = acJson?.payload?.sections?.flatMap((s: any) => s.rows) ?? acJson?.payload?.exactMatch ? [acJson.payload.exactMatch] : [];
    console.log('first 3 results:', JSON.stringify(items.slice(0, 3)));
  } else {
    console.log('blocked:', acText.slice(0, 100));
  }

  // Test 4: GIS bounding box for Austin TX
  console.log('\n── Test 4: GIS bounding box Austin TX ──');
  const { status: bbStatus, text: bbText } = await browserFetchJson(page,
    'https://www.redfin.com/stingray/api/gis?al=1&num_homes=3&max_lat=30.516&min_lat=30.098&max_lon=-97.571&min_lon=-97.937&sf=1,2,3,5,6,7&status=1&uipt=1,2,3,4,5,6&v=8'
  );
  console.log('bbox status:', bbStatus);
  if (bbStatus === 200) {
    try {
      const bbJson = JSON.parse(bbText.replace(/^\s*{}\s*&&\s*/, ''));
      console.log('payload keys:', Object.keys(bbJson?.payload ?? {}).join(', '));
      const bbHomes = bbJson?.payload?.homes ?? [];
      console.log('homes count:', bbHomes.length);
      bbHomes.slice(0, 3).forEach((h: any) => console.log(` → ${h.streetLine?.value ?? h.streetLine}, ${h.city}, ${h.state} $${h.price?.value?.toLocaleString()}`));
      if (bbHomes.length > 0) {
        const h = bbHomes[0];
        console.log('photoInfo:', JSON.stringify(h.photoInfo)?.slice(0, 500));
        console.log('lotSize:', JSON.stringify(h.lotSize));
      }
    } catch (e) {
      console.log('parse error:', e);
      console.log('raw slice:', bbText.slice(0, 300));
    }
  } else {
    console.log('blocked:', bbText.slice(0, 100));
  }

  // Test 5: autocomplete via page interaction (type in search box)
  console.log('\n── Test 5: autocomplete via search box interaction ──');
  const captured5: string[] = [];
  const onResp5 = async (resp: any) => {
    const u: string = resp.url();
    if (u.includes('autocomplete') || u.includes('location-autocomplete')) {
      captured5.push(await resp.text().catch(() => ''));
    }
  };
  page.on('response', onResp5);
  try {
    const searchSel = 'input[type="search"], input[placeholder*="ity"], input[placeholder*="search"], input[name*="search"], [data-rf-test-id*="search"] input';
    const inp = await page.waitForSelector(searchSel, { timeout: 5000 }).catch(() => null);
    if (inp) {
      await inp.click();
      await inp.type('Austin TX', { delay: 80 });
      await new Promise(r => setTimeout(r, 2500));
      console.log('captured autocomplete responses:', captured5.length);
      if (captured5.length > 0) console.log('first response slice:', captured5[0].slice(0, 400));
    } else {
      console.log('search input not found');
    }
  } finally {
    page.off('response', onResp5);
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
