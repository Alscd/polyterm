// Pass 7: hit all 11 MediaMarkt climatiseur PDPs directly, read price + delivery date + pickup.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = 'scripts/ac-search/out';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);
const B = 'https://www.mediamarkt.ch/fr/product/';
const HREFS = [
  '_ok-oac-7022w-ch-2099462.html',
  '_dreame-p-wind10-c-led-display-camel-gold-max-raumgrosse-33-m-eek-a-2291187.html',
  '_koenic-kac-9022-w-ch-wi-fi-2099464.html',
  '_olimpia-splendid-dolceclima-slim-8wwb-climatiseur-blanc-max-taille-de-la-piece-60-m-eek-a-178561401.html',
  '_olimpia-splendid-dolceclima-aira-10-a-nw-climatiseur-mobile-blanc-max-taille-de-la-piece-80-m-eek-a-176072621.html',
  '_olimpia-splendid-dolceclima-aira-14-d-nw-climatiseur-blanc-max-taille-de-la-piece-110-m-eek-a-176081968.html',
  '_olimpia-splendid-dolceclima-10-hp-climatiseur-mobile-avec-fonction-chauffage-2600-w-10000-btu-35m2-wifi-klimagerat-weiss-max-taille-de-la-piece-35-m-eek-a-175530213.html',
  '_de-longhi-pac-ex93-extreme-a-2206823.html',
  '_stadler-form-emil-mobile-klimaanlage-weiss-max-raumgrosse-35-m-eek--2290107.html',
  '_koenic-kac-12022-ch-wlan-2099465.html',
  '_electrolux-ecu7678csw-comfort-700-portables-klimagerat-weiss-max-raumgrosse-35-m-eek-a-2286771.html',
];

async function accept(page) {
  for (const t of ['Tout accepter', 'Accepter', "J'accepte", 'OK']) {
    try { const b = page.getByRole('button', { name: t, exact: false }).first();
      if (await b.isVisible({ timeout: 1000 })) { await b.click({ timeout: 2000 }); await page.waitForTimeout(500); return; } } catch {}
  }
}

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ locale: 'fr-CH', timezoneId: 'Europe/Zurich', viewport: { width: 1366, height: 950 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

let first = true;
for (const h of HREFS) {
  const page = await ctx.newPage();
  try {
    await page.goto(B + h, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2200);
    if (first) { await accept(page); first = false; await page.waitForTimeout(800); }
    const data = await page.evaluate(() => {
      const body = document.body.innerText || '';
      const title = (document.querySelector('h1')?.innerText || document.title || '').slice(0, 90);
      const price = (body.match(/CHF\s?\d[\d'’]*\.?\d{0,2}/) || [''])[0];
      const r = /Livraison\s*\d[\d.]*|Disponible en ligne|Online Only|Disponible de suite|Ramasser|enl[eè]vement|Malheureusement|rupture|[ée]puis|Indisponible|sous \d+ jour|En stock|EEK|BTU|R290|dB/i;
      const lines = [...new Set(body.split('\n').map(s=>s.trim()).filter(s=>s && r.test(s) && s.length<90))].slice(0,10);
      return { title, price, lines };
    });
    log(`\n== ${data.price} | ${data.title}`);
    log('   ' + data.lines.join('  ||  '));
  } catch (e) { log(`\n== ${h} :: ERR ${String(e).slice(0,70)}`); }
  finally { await page.close().catch(()=>{}); }
}
await browser.close();
log('\n===DONE7===');
