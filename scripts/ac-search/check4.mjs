// Pass 4: name the Geneva store.
// MediaMarkt: open picker, fill the DIALOG-scoped input with a Geneva NPA, read store stock.
// Conforama: accept cookies, open store-availability, list every line naming a CH city/shop.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = 'scripts/ac-search/out';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);
const clip = (s, n = 3500) => (s || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);

async function accept(page) {
  for (const t of ['Autoriser tous les cookies', 'Tout accepter', 'Accepter', "J'accepte", 'OK']) {
    try { const b = page.getByRole('button', { name: t, exact: false }).first();
      if (await b.isVisible({ timeout: 1000 })) { await b.click({ timeout: 2000 }); await page.waitForTimeout(700); return; } } catch {}
  }
}
const cityLines = (page) => page.evaluate(() => {
  const r = /Meyrin|Gen[eè]ve|Vernier|Carouge|Lausanne|Etoy|Crissier|Conthey|Praille|Balexert|Nyon|Morges|en stock|Disponible|Indisponible|Rupture/i;
  return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s && r.test(s) && s.length<80))].slice(0,40).join(' || ');
});

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ locale: 'fr-CH', timezoneId: 'Europe/Zurich', viewport: { width: 1366, height: 950 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

async function mm(name, url) {
  const page = await ctx.newPage();
  log(`\n===== MM :: ${name} =====`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 50000 });
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1000);
    for (const lbl of ['Sélectionner un magasin', 'Mon magasin']) {
      try { const el = page.getByText(lbl, { exact: false }).first();
        if (await el.isVisible({ timeout: 1500 })) { await el.click({ timeout: 2500 }); await page.waitForTimeout(1800); break; } } catch {}
    }
    let typed = false;
    for (const npa of ['1227', 'Genève']) {
      try {
        const inp = page.locator('[role="dialog"] input, [aria-modal="true"] input, .modal input').first();
        if (await inp.isVisible({ timeout: 2000 })) {
          await inp.click(); await inp.fill(npa); await page.waitForTimeout(900);
          await page.keyboard.press('ArrowDown').catch(()=>{}); await page.waitForTimeout(400);
          await page.keyboard.press('Enter').catch(()=>{}); await page.waitForTimeout(3000); typed = true; log('TYPED:', npa); break;
        }
      } catch {}
    }
    log('STORES:', await cityLines(page).catch(()=>''));
    let dlg = '';
    try { dlg = await page.evaluate(() => { const d = document.querySelector('[role="dialog"],[aria-modal="true"]'); return d ? d.innerText.slice(0,2200) : ''; }); } catch {}
    log('---DIALOG---'); log(clip(dlg, 2200)); log('---END---');
    await page.screenshot({ path: `${OUT}/mm4_${name}.png`, fullPage: true }).catch(()=>{});
  } catch (e) { log('ERROR:', String(e).slice(0,200)); }
  finally { await page.close().catch(()=>{}); }
}

async function cf() {
  const page = await ctx.newPage();
  log(`\n===== CONFORAMA OHMEX =====`);
  try {
    await page.goto('https://www.conforama.ch/fr/climatiseur-portable-ohmex-ohm-air-9100con/product/599887', { waitUntil: 'domcontentloaded', timeout: 50000 });
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1500);
    for (const lbl of ['Retrait immédiat', 'En savoir plus', 'Disponibilité']) {
      try { const el = page.getByText(lbl, { exact: false }).first();
        if (await el.isVisible({ timeout: 1500 })) { await el.scrollIntoViewIfNeeded().catch(()=>{}); await el.click({ timeout: 2500 }); await page.waitForTimeout(2500); log('CLICKED:', lbl); break; } } catch {}
    }
    try { const inp = page.getByPlaceholder(/code postal|postal|NPA|ville/i).first();
      if (await inp.isVisible({ timeout: 1500 })) { await inp.fill('1225'); await page.keyboard.press('Enter').catch(()=>{}); await page.waitForTimeout(2500); log('NPA 1225'); } } catch {}
    log('STORES:', await cityLines(page).catch(()=>''));
    await page.screenshot({ path: `${OUT}/cf4.png`, fullPage: true }).catch(()=>{});
  } catch (e) { log('ERROR:', String(e).slice(0,200)); }
  finally { await page.close().catch(()=>{}); }
}

await mm('ok_OAC_7022W', 'https://www.mediamarkt.ch/fr/product/_ok-oac-7022w-ch-2099462.html');
await mm('DREAME_PWind10', 'https://www.mediamarkt.ch/fr/product/_dreame-pwind10-9000-btu-tragbare-klimaanlage-weissbeige-max-raumgrosse-33-m-eek-a-2290547.html');
await cf();
await browser.close();
log('\n===DONE4===');
