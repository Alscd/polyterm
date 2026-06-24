// Geneva mobile-AC availability scout.
// Pass 1: load each product page in a real browser (CI runner has open internet),
// dismiss cookie walls, dump visible text + screenshot. Reconnaissance for the
// store-picker / postal-code interactions added in later passes.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const OUT = 'scripts/ac-search/out';
mkdirSync(OUT, { recursive: true });

const TARGETS = [
  { id: 'mm_ok7022',   site: 'mediamarkt.ch',   name: 'ok. OAC 7022W CH (7000 BTU)',          url: 'https://www.mediamarkt.ch/fr/product/_ok-oac-7022w-ch-2099462.html' },
  { id: 'mm_dreame',   site: 'mediamarkt.ch',   name: 'DREAME P-Wind10 9000 BTU',             url: 'https://www.mediamarkt.ch/fr/product/_dreame-pwind10-9000-btu-tragbare-klimaanlage-weissbeige-max-raumgrosse-33-m-eek-a-2290547.html' },
  { id: 'mm_koenic',   site: 'mediamarkt.ch',   name: 'KOENIC KAC 9022 W CH WLAN',            url: 'https://www.mediamarkt.ch/fr/product/_koenic-kac-9022-w-ch-wlan-2099464.html' },
  { id: 'id_inter9k',  site: 'interdiscount.ch',name: 'Intertronic 9000 BTU',                 url: 'https://www.interdiscount.ch/fr/product/intertronic-climatiseur-mobile-9000-btu-h-0014133827' },
  { id: 'id_dreame',   site: 'interdiscount.ch',name: 'DREAME P-Wind10 (Interdiscount)',       url: 'https://www.interdiscount.ch/fr/product/dreame-climatiseur-p-wind10-mobile-9000-btu-h-0014435498' },
  { id: 'cf_ohmex',    site: 'conforama.ch',    name: 'OHMEX OHM-AIR-9100CON 9000 BTU',       url: 'https://www.conforama.ch/fr/climatiseur-portable-ohmex-ohm-air-9100con/product/599887' },
  { id: 'fust_prim',   site: 'fust.ch',         name: 'Primotecq CL 7020 (7000 BTU)',         url: 'https://www.fust.ch/fr/maison/chauffage-ventilation-climatisation/climatiseur/primotecq-cl-7020-/p/10251965' },
  { id: 'jumbo_cold',  site: 'jumbo.ch',        name: 'Coldtec MK-9000 (9000 BTU)',           url: 'https://www.jumbo.ch/fr/sejour-eclairage/radiateurspoelesclimatiseurs/climatiseurs/coldtec-climatiseur-mobile-mk-9000--26-kw/p/6606286' },
  { id: 'dig_emz',     site: 'digitec.ch',      name: 'EMZ 9000 BTU A++',                     url: 'https://www.digitec.ch/fr/s1/product/emz-climatiseur-mobile-9000-btu-26-kw-a-appareil-3-en-1-blanc-26-m-9000-btuh-climatiseur-21805648' },
  { id: 'gal_tcl',     site: 'galaxus.ch',      name: 'TCL 9000 BTU',                         url: 'https://www.galaxus.ch/fr/s2/product/tcl-climatiseur-mobile-9000-btu-appareil-3-en-1-puissance-26-kw-blanc-26-m-9000-btuh-climatiseur-15853509' },
  { id: 'jumbo_kit',   site: 'jumbo.ch',        name: 'Trotec AirLock 100 (kit fenetre)',     url: 'https://www.jumbo.ch/fr/sejour-eclairage/radiateurspoelesclimatiseurs/climatiseurs/trotec-couverture-de-fenetre-airlock-100/p/6587844' },
];

const COOKIE_TEXTS = ['Tout accepter', 'Accepter tout', "J'accepte", 'Accepter', 'Tout accepter et continuer', 'Accept all', 'Einverstanden', 'OK', "D'accord"];
const BLOCK_HINTS = ['Access Denied', 'Pardon Our Interruption', 'unusual traffic', 'captcha', 'Request unsuccessful', 'Bot Manager', 'Cloudflare', 'verify you are human', 'Zugriff verweigert', 'Accès refusé'];

function clip(s, n = 5000) { return (s || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, n); }

async function dismissCookies(page) {
  for (const t of COOKIE_TEXTS) {
    try {
      const btn = page.getByRole('button', { name: t, exact: false }).first();
      if (await btn.isVisible({ timeout: 1200 })) { await btn.click({ timeout: 2000 }); await page.waitForTimeout(800); return t; }
    } catch {}
  }
  for (const sel of ['#onetrust-accept-btn-handler', 'button#uc-btn-accept-banner', '[data-testid="uc-accept-all-button"]', '.cmp-btn-accept']) {
    try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 1000 })) { await b.click({ timeout: 2000 }); await page.waitForTimeout(800); return sel; } } catch {}
  }
  return null;
}

const results = [];
const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'] });
const ctx = await browser.newContext({
  locale: 'fr-CH',
  timezoneId: 'Europe/Zurich',
  viewport: { width: 1366, height: 900 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  geolocation: { latitude: 46.20, longitude: 6.17 },
  permissions: ['geolocation'],
});
await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

for (const t of TARGETS) {
  const page = await ctx.newPage();
  const rec = { id: t.id, site: t.site, name: t.name, url: t.url };
  try {
    let status = null;
    const resp = await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 50000 });
    status = resp ? resp.status() : null;
    await page.waitForTimeout(2500);
    const cookie = await dismissCookies(page).catch(() => null);
    await page.waitForTimeout(1500);
    const title = await page.title().catch(() => '');
    const finalUrl = page.url();
    let bodyText = '';
    try { bodyText = await page.evaluate(() => document.body ? document.body.innerText : ''); } catch {}
    const blocked = BLOCK_HINTS.some(h => (bodyText + ' ' + title).toLowerCase().includes(h.toLowerCase())) || status === 403 || status === 429;
    await page.screenshot({ path: `${OUT}/${t.id}.png`, fullPage: false }).catch(() => {});
    rec.status = status; rec.finalUrl = finalUrl; rec.title = title; rec.cookie = cookie; rec.blocked = blocked;
    rec.text = clip(bodyText);
    console.log(`\n===TARGET=== ${t.id} | ${t.name}`);
    console.log(`SITE: ${t.site}`);
    console.log(`HTTP_STATUS: ${status}`);
    console.log(`FINAL_URL: ${finalUrl}`);
    console.log(`TITLE: ${title}`);
    console.log(`COOKIE_DISMISSED: ${cookie}`);
    console.log(`BLOCKED: ${blocked ? 'YES' : 'no'}`);
    console.log(`---TEXT-START---`);
    console.log(clip(bodyText));
    console.log(`---TEXT-END---`);
  } catch (e) {
    rec.error = String(e).slice(0, 400);
    console.log(`\n===TARGET=== ${t.id} | ${t.name}`);
    console.log(`ERROR: ${rec.error}`);
  } finally {
    await page.close().catch(() => {});
    results.push(rec);
  }
}

writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
console.log('\n===DONE=== targets:', results.length);
