// Pass 2: real interaction. Set postal 1225 + open store pickers on the sites
// that render (MediaMarkt, Conforama), and retry the blocked ones with a
// homepage warm-up + HTTP/2 disabled.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const OUT = 'scripts/ac-search/out';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);
const clip = (s, n = 6000) => (s || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
const txt = (page) => page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');

const COOKIE_TEXTS = ['Tout accepter', 'Accepter tout', "J'accepte", 'Accepter', 'Accept all', 'Einverstanden', 'OK', "D'accord", 'Tout accepter et fermer'];
async function cookies(page) {
  for (const t of COOKIE_TEXTS) {
    try { const b = page.getByRole('button', { name: t, exact: false }).first();
      if (await b.isVisible({ timeout: 1000 })) { await b.click({ timeout: 2000 }); await page.waitForTimeout(700); return t; } } catch {}
  }
  for (const sel of ['#onetrust-accept-btn-handler', 'button#uc-btn-accept-banner', '[data-testid="uc-accept-all-button"]', '.cmp-btn-accept', '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll']) {
    try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 800 })) { await b.click({ timeout: 2000 }); await page.waitForTimeout(700); return sel; } } catch {}
  }
  return null;
}

async function newCtx(browser) {
  const ctx = await browser.newContext({
    locale: 'fr-CH', timezoneId: 'Europe/Zurich', viewport: { width: 1366, height: 950 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8' },
    geolocation: { latitude: 46.20, longitude: 6.17 }, permissions: ['geolocation'],
  });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  return ctx;
}

async function mediamarkt(ctx, name, url) {
  const page = await ctx.newPage();
  log(`\n========== MEDIAMARKT :: ${name} ==========`);
  try {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 50000 });
    log('HTTP_STATUS:', r && r.status());
    await page.waitForTimeout(2500);
    await cookies(page);
    await page.waitForTimeout(1200);
    let avail = '';
    try {
      avail = await page.evaluate(() => {
        const hit = [...document.querySelectorAll('*')].find(e => /Disponible en ligne|Livraison\s+\d|Ramasser/i.test(e.textContent || '') && e.children.length < 12);
        return hit ? hit.closest('section,div,article')?.innerText?.slice(0, 800) : '';
      });
    } catch {}
    log('AVAIL_BLOCK:', clip(avail, 800).replace(/\n+/g, ' | '));
    for (const label of ['Sélectionner un magasin', 'Choisir un magasin', 'Ramasser', 'Mon magasin', 'Vérifier la disponibilité']) {
      try {
        const el = page.getByText(label, { exact: false }).first();
        if (await el.isVisible({ timeout: 1500 })) { await el.click({ timeout: 2500 }); await page.waitForTimeout(1800); log('CLICKED:', label); break; }
      } catch {}
    }
    for (const q of ['1225', 'Genève']) {
      try {
        const input = page.locator('input[type="text"], input[type="search"], input:not([type])').filter({ hasNot: page.locator('[disabled]') }).last();
        if (await input.isVisible({ timeout: 1500 })) { await input.fill(q); await page.waitForTimeout(2200); await page.keyboard.press('Enter').catch(()=>{}); await page.waitForTimeout(2200); log('TYPED:', q); break; }
      } catch {}
    }
    await page.waitForTimeout(1500);
    let modalText = '';
    try {
      modalText = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"], [aria-modal="true"], .modal, [class*="odal"]');
        return (d ? d.innerText : document.body.innerText).slice(0, 2500);
      });
    } catch {}
    log('---STORE-PICKER-START---'); log(clip(modalText, 2500)); log('---STORE-PICKER-END---');
    await page.screenshot({ path: `${OUT}/mm_${name.replace(/\W+/g,'_')}.png` }).catch(()=>{});
  } catch (e) { log('ERROR:', String(e).slice(0, 300)); }
  finally { await page.close().catch(()=>{}); }
}

async function conforama(ctx) {
  const page = await ctx.newPage();
  log(`\n========== CONFORAMA :: OHMEX OHM-AIR-9100CON ==========`);
  const url = 'https://www.conforama.ch/fr/climatiseur-portable-ohmex-ohm-air-9100con/product/599887';
  try {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 50000 });
    log('HTTP_STATUS:', r && r.status());
    await page.waitForTimeout(2500); await cookies(page); await page.waitForTimeout(1000);
    for (const label of ['Voir les caractéristiques détaillées', 'Caractéristiques', 'Voir les caractéristiques']) {
      try { const el = page.getByText(label, { exact: false }).first();
        if (await el.isVisible({ timeout: 1500 })) { await el.click({ timeout: 2500 }); await page.waitForTimeout(1500); log('CLICKED:', label); break; } } catch {}
    }
    await page.waitForTimeout(800);
    let specs = '';
    try { specs = await page.evaluate(() => {
      const b = document.body.innerText;
      const i = b.search(/Caract[ée]ristiques/i); return i >= 0 ? b.slice(i, i + 2500) : b.slice(0, 2000);
    }); } catch {}
    log('---SPECS-START---'); log(clip(specs, 2500)); log('---SPECS-END---');
    let stores = '';
    for (const label of ['En savoir plus', 'Disponibilité', 'Voir la disponibilité', 'Retrait']) {
      try { const el = page.getByText(label, { exact: false }).first();
        if (await el.isVisible({ timeout: 1500 })) { await el.click({ timeout: 2500 }); await page.waitForTimeout(2000); log('CLICKED:', label); break; } } catch {}
    }
    for (const q of ['1225']) {
      try { const input = page.getByPlaceholder(/code postal|postal|NPA|ville/i).first();
        if (await input.isVisible({ timeout: 1500 })) { await input.fill(q); await page.waitForTimeout(800); await page.keyboard.press('Enter').catch(()=>{}); await page.waitForTimeout(2200); log('POSTAL_SET:', q); } } catch {}
    }
    await page.waitForTimeout(1500);
    try { stores = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"], [aria-modal="true"], .modal');
      const b = (d ? d.innerText : document.body.innerText);
      const i = b.search(/magasin|Meyrin|Gen[èe]ve|Retrait|Disponib/i); return i >= 0 ? b.slice(i, i + 2200) : b.slice(0, 1500);
    }); } catch {}
    log('---STORES-START---'); log(clip(stores, 2200)); log('---STORES-END---');
    await page.screenshot({ path: `${OUT}/cf_ohmex2.png` }).catch(()=>{});
  } catch (e) { log('ERROR:', String(e).slice(0, 300)); }
  finally { await page.close().catch(()=>{}); }
}

async function warmThenGet(ctx, name, home, url) {
  const page = await ctx.newPage();
  log(`\n========== RETRY :: ${name} ==========`);
  try {
    await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>{});
    await page.waitForTimeout(2500); await cookies(page); await page.waitForTimeout(1500);
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    log('HTTP_STATUS:', r && r.status());
    await page.waitForTimeout(2500); await cookies(page); await page.waitForTimeout(1200);
    const body = await txt(page);
    log('TITLE:', await page.title().catch(()=>''));
    log('LEN:', (body||'').length);
    log('---TEXT-START---'); log(clip(body, 4500)); log('---TEXT-END---');
    await page.screenshot({ path: `${OUT}/retry_${name}.png` }).catch(()=>{});
  } catch (e) { log('ERROR:', String(e).slice(0, 300)); }
  finally { await page.close().catch(()=>{}); }
}

const browserH2off = await chromium.launch({ args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--disable-http2'] });
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });

const ctx = await newCtx(browser);
await mediamarkt(ctx, 'ok_OAC_7022W', 'https://www.mediamarkt.ch/fr/product/_ok-oac-7022w-ch-2099462.html');
await mediamarkt(ctx, 'DREAME_PWind10', 'https://www.mediamarkt.ch/fr/product/_dreame-pwind10-9000-btu-tragbare-klimaanlage-weissbeige-max-raumgrosse-33-m-eek-a-2290547.html');
await conforama(ctx);

const ctx2 = await newCtx(browserH2off);
await warmThenGet(ctx2, 'interdiscount', 'https://www.interdiscount.ch/fr', 'https://www.interdiscount.ch/fr/product/intertronic-climatiseur-mobile-9000-btu-h-0014133827');
await warmThenGet(ctx2, 'fust', 'https://www.fust.ch/fr', 'https://www.fust.ch/fr/maison/chauffage-ventilation-climatisation/climatiseur/primotecq-cl-7020-/p/10251965');
await warmThenGet(ctx2, 'jumbo', 'https://www.jumbo.ch/fr', 'https://www.jumbo.ch/fr/sejour-eclairage/radiateurspoelesclimatiseurs/climatiseurs/coldtec-climatiseur-mobile-mk-9000--26-kw/p/6606286');
await warmThenGet(ctx2, 'digitec', 'https://www.digitec.ch/fr', 'https://www.digitec.ch/fr/s1/product/emz-climatiseur-mobile-9000-btu-26-kw-a-appareil-3-en-1-blanc-26-m-9000-btuh-climatiseur-21805648');
await warmThenGet(ctx2, 'galaxus', 'https://www.galaxus.ch/fr', 'https://www.galaxus.ch/fr/s2/product/tcl-climatiseur-mobile-9000-btu-appareil-3-en-1-puissance-26-kw-blanc-26-m-9000-btuh-climatiseur-15853509');

await browser.close(); await browserH2off.close();
log('\n===DONE2===');
