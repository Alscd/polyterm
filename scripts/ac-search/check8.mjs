// Pass 8: focus 8000-9000 BTU. Olimpia 8WWB full spec+rating, DREAME pickup, and
// retry the blocked retailers with the WebKit engine (often bypasses Akamai on CI).
import { chromium, webkit } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = 'scripts/ac-search/out';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);

const SPEC = /BTU|R290|R-290|dB|EEK|classe|[ée]nerg|WLAN|WiFi|Wi-Fi|\bapp\b|d[ée]shumid|poids|\d+\s?kg|[ée]valuation|avis|Disponible|Livraison\s*\d|Malheureusement|rupture|[ée]puis|en stock|de suite|sous \d+ jour|Ramasser|Indisponible/i;
const specLines = (page) => page.evaluate((rs) => {
  const r = new RegExp(rs, 'i');
  const b = document.body.innerText || '';
  return [...new Set(b.split('\n').map(s=>s.trim()).filter(s=>s && r.test(s) && s.length<100))].slice(0,26);
}, SPEC.source);

async function accept(page) {
  for (const t of ['Autoriser tous les cookies','Tout accepter','Accepter',"J'accepte",'Accept all','OK','Einverstanden']) {
    try { const b = page.getByRole('button', { name: t, exact: false }).first();
      if (await b.isVisible({ timeout: 1000 })) { await b.click({ timeout: 2000 }); await page.waitForTimeout(600); return; } } catch {}
  }
}

async function mmFull(label, url) {
  const br = await chromium.launch({ args: ['--no-sandbox','--disable-blink-features=AutomationControlled'] });
  const ctx = await br.newContext({ locale:'fr-CH', timezoneId:'Europe/Zurich', viewport:{width:1366,height:950},
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
  await ctx.addInitScript(() => { Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); });
  const page = await ctx.newPage();
  log(`\n######### MM :: ${label} #########`);
  try {
    await page.goto(url, { waitUntil:'domcontentloaded', timeout:50000 });
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1000);
    for (let i=0;i<5;i++){ await page.mouse.wheel(0,2200); await page.waitForTimeout(700); }
    (await specLines(page)).forEach(l=>log('  ', l));
  } catch(e){ log('ERR', String(e).slice(0,150)); }
  finally { await br.close().catch(()=>{}); }
}

async function wk(label, home, url) {
  const br = await webkit.launch();
  const ctx = await br.newContext({ locale:'fr-CH', timezoneId:'Europe/Zurich', viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  log(`\n######### WEBKIT :: ${label} #########`);
  try {
    await page.goto(home, { waitUntil:'domcontentloaded', timeout:40000 }).catch(()=>{});
    await page.waitForTimeout(2000); await accept(page); await page.waitForTimeout(1200);
    const r = await page.goto(url, { waitUntil:'domcontentloaded', timeout:40000 });
    log('HTTP', r && r.status());
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1200);
    for (let i=0;i<3;i++){ await page.mouse.wheel(0,2000); await page.waitForTimeout(700); }
    const title = await page.title().catch(()=>'');
    log('TITLE', title);
    const ls = await specLines(page).catch(()=>[]);
    if (ls.length) ls.forEach(l=>log('  ', l)); else log('  (vide / bloqué)');
  } catch(e){ log('ERR', String(e).slice(0,150)); }
  finally { await br.close().catch(()=>{}); }
}

await mmFull('Olimpia Splendid Dolceclima Slim 8WWB (321.-)', 'https://www.mediamarkt.ch/fr/product/_olimpia-splendid-dolceclima-slim-8wwb-climatiseur-blanc-max-taille-de-la-piece-60-m-eek-a-178561401.html');
await mmFull('DREAME P-Wind10-C 9000 (349.-)', 'https://www.mediamarkt.ch/fr/product/_dreame-p-wind10-c-led-display-camel-gold-max-raumgrosse-33-m-eek-a-2291187.html');
await mmFull('KOENIC 9022 W CH WLAN (359.95)', 'https://www.mediamarkt.ch/fr/product/_koenic-kac-9022-w-ch-wi-fi-2099464.html');

await wk('Interdiscount Intertronic 9000', 'https://www.interdiscount.ch/fr', 'https://www.interdiscount.ch/fr/product/intertronic-climatiseur-mobile-9000-btu-h-0014133827');
await wk('Jumbo Coldtec MK-9000', 'https://www.jumbo.ch/fr', 'https://www.jumbo.ch/fr/sejour-eclairage/radiateurspoelesclimatiseurs/climatiseurs/coldtec-climatiseur-mobile-mk-9000--26-kw/p/6606286');
await wk('digitec EMZ 9000 A++', 'https://www.digitec.ch/fr', 'https://www.digitec.ch/fr/s1/product/emz-climatiseur-mobile-9000-btu-26-kw-a-appareil-3-en-1-blanc-26-m-9000-btuh-climatiseur-21805648');
await wk('galaxus TCL 9000', 'https://www.galaxus.ch/fr', 'https://www.galaxus.ch/fr/s2/product/tcl-climatiseur-mobile-9000-btu-appareil-3-en-1-puissance-26-kw-blanc-26-m-9000-btuh-climatiseur-15853509');

log('\n===DONE8===');
