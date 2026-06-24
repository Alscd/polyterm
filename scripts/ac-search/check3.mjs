// Pass 3: nail Geneva store availability on the two sites that render.
// MediaMarkt: open store picker, type Geneva, read per-store stock + delivery date.
// Conforama: accept cookies, open "disponibilité" store list, read which shops + set 1225.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = 'scripts/ac-search/out';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);
const clip = (s, n = 3500) => (s || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);

async function acceptCookies(page) {
  const names = ['Autoriser tous les cookies', 'Accepter tous les cookies', 'Tout accepter', 'Accepter', "J'accepte", 'Accept all', 'OK'];
  for (const t of names) {
    try { const b = page.getByRole('button', { name: t, exact: false }).first();
      if (await b.isVisible({ timeout: 1000 })) { await b.click({ timeout: 2000 }); await page.waitForTimeout(700); log('COOKIE:', t); return; } } catch {}
  }
  for (const sel of ['#onetrust-accept-btn-handler', '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', '[data-testid="uc-accept-all-button"]']) {
    try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 800 })) { await b.click(); await page.waitForTimeout(700); log('COOKIE:', sel); return; } } catch {}
  }
}
const lines = (page, re) => page.evaluate((rs) => {
  const r = new RegExp(rs, 'i');
  return [...new Set((document.body.innerText || '').split('\n').map(s => s.trim()).filter(s => s && r.test(s)))].slice(0, 25).join(' || ');
}, re.source);

async function newCtx(browser) {
  const ctx = await browser.newContext({
    locale: 'fr-CH', timezoneId: 'Europe/Zurich', viewport: { width: 1366, height: 950 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8' },
  });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  return ctx;
}

async function mm(ctx, name, url) {
  const page = await ctx.newPage();
  log(`\n========== MEDIAMARKT :: ${name} ==========`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 50000 });
    await page.waitForTimeout(2500); await acceptCookies(page); await page.waitForTimeout(1000);
    log('DELIVERY/PICKUP:', await lines(page, /Livraison|Disponible en ligne|Ramasser|Retrait|En stock|stock/).catch(()=>''));

    let opened = false;
    for (const lbl of ['Sélectionner un magasin', 'Mon magasin', 'Ramasser']) {
      try { const el = page.getByText(lbl, { exact: false }).first();
        if (await el.isVisible({ timeout: 1500 })) { await el.click({ timeout: 2500 }); await page.waitForTimeout(1800); opened = true; log('OPENED:', lbl); break; } } catch {}
    }
    if (opened) {
      let filled = false;
      for (const ph of [/code postal/i, /ville/i, /Rechercher/i]) {
        try { const inp = page.getByPlaceholder(ph).first();
          if (await inp.isVisible({ timeout: 1500 })) { await inp.click(); await inp.fill('Genève'); await page.waitForTimeout(2800); filled = true; log('FILLED placeholder:', ph.source); break; } } catch {}
      }
      if (!filled) { try { const tb = page.getByRole('textbox').last(); if (await tb.isVisible({ timeout: 1500 })) { await tb.fill('Genève'); await page.waitForTimeout(2800); filled = true; log('FILLED textbox'); } } catch {} }
      await page.waitForTimeout(1500);
      let modal = '';
      try { modal = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"], [aria-modal="true"]'); return (d ? d.innerText : document.body.innerText).slice(0, 3000);
      }); } catch {}
      log('---STORE-RESULTS-START---'); log(clip(modal)); log('---STORE-RESULTS-END---');
      await page.screenshot({ path: `${OUT}/mm3_${name}.png` }).catch(()=>{});
    }
  } catch (e) { log('ERROR:', String(e).slice(0, 250)); }
  finally { await page.close().catch(()=>{}); }
}

async function conforama(ctx) {
  const page = await ctx.newPage();
  log(`\n========== CONFORAMA :: OHMEX 9100CON ==========`);
  try {
    await page.goto('https://www.conforama.ch/fr/climatiseur-portable-ohmex-ohm-air-9100con/product/599887', { waitUntil: 'domcontentloaded', timeout: 50000 });
    await page.waitForTimeout(2500); await acceptCookies(page); await page.waitForTimeout(1200);
    log('AVAIL_LINES:', await lines(page, /Disponible|Livraison|Retrait|magasin/).catch(()=>''));
    for (const lbl of ['En savoir plus', 'Disponibilité', 'Retrait immédiat', 'Voir la disponibilité']) {
      try { const el = page.getByText(lbl, { exact: false }).first();
        if (await el.isVisible({ timeout: 1500 })) { await el.scrollIntoViewIfNeeded().catch(()=>{}); await el.click({ timeout: 2500 }); await page.waitForTimeout(2200); log('CLICKED:', lbl); break; } } catch {}
    }
    try { const inp = page.getByPlaceholder(/code postal|postal|NPA/i).first();
      if (await inp.isVisible({ timeout: 1500 })) { await inp.fill('1225'); await page.keyboard.press('Enter').catch(()=>{}); await page.waitForTimeout(2200); log('POSTAL: 1225'); } } catch {}
    await page.waitForTimeout(1200);
    let modal = '';
    try { modal = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"], [aria-modal="true"], .modal');
      const b = (d ? d.innerText : document.body.innerText);
      const i = b.search(/Meyrin|Gen[èe]ve|Lausanne|Vernier|magasin|Retrait|Disponib/i); return i >= 0 ? b.slice(i, i + 2600) : b.slice(0, 1500);
    }); } catch {}
    log('---CF-STORES-START---'); log(clip(modal, 2600)); log('---CF-STORES-END---');
    await page.screenshot({ path: `${OUT}/cf3.png` }).catch(()=>{});
  } catch (e) { log('ERROR:', String(e).slice(0, 250)); }
  finally { await page.close().catch(()=>{}); }
}

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
const ctx = await newCtx(browser);
await mm(ctx, 'ok_OAC_7022W', 'https://www.mediamarkt.ch/fr/product/_ok-oac-7022w-ch-2099462.html');
await mm(ctx, 'DREAME_PWind10', 'https://www.mediamarkt.ch/fr/product/_dreame-pwind10-9000-btu-tragbare-klimaanlage-weissbeige-max-raumgrosse-33-m-eek-a-2290547.html');
await conforama(ctx);
await browser.close();
log('\n===DONE3===');
