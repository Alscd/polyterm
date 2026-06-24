// Pass 6 (today's live re-scan). Robust signal = the DEFAULT delivery date on each PDP.
// 1) MediaMarkt: scrape the climatiseurs category, then open every in-budget mobile unit
//    and read its real delivery date + online/pickup status.
// 2) Conforama: re-check OHMEX + the climatiseurs category availability.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = 'scripts/ac-search/out';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);

async function accept(page) {
  for (const t of ['Autoriser tous les cookies', 'Tout accepter', 'Accepter', "J'accepte", 'OK']) {
    try { const b = page.getByRole('button', { name: t, exact: false }).first();
      if (await b.isVisible({ timeout: 1000 })) { await b.click({ timeout: 2000 }); await page.waitForTimeout(600); return; } } catch {}
  }
}
const availLines = (page) => page.evaluate(() => {
  const r = /Livraison\s*\d|Disponible en ligne|Online Only|Disponible de suite|Ramasser|enl[eè]vement|Malheureusement|rupture|[ée]puis|Indisponible|sous \d+ jour|En stock/i;
  return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s && r.test(s) && s.length<95))].slice(0,12).join('  ||  ');
});

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ locale: 'fr-CH', timezoneId: 'Europe/Zurich', viewport: { width: 1366, height: 950 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

async function mmCategory() {
  const page = await ctx.newPage();
  log('\n######### MEDIAMARKT — CATEGORIE CLIMATISEURS #########');
  let products = [];
  try {
    await page.goto('https://www.mediamarkt.ch/fr/category/climatiseurs-681556.html', { waitUntil: 'domcontentloaded', timeout: 50000 });
    await page.waitForTimeout(3000); await accept(page); await page.waitForTimeout(1500);
    for (let i=0;i<4;i++){ await page.mouse.wheel(0, 2500); await page.waitForTimeout(900); }
    products = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('a[href*="/product/"]').forEach(a => {
        const t = (a.innerText||'').trim();
        if (t && t.length>8 && /climatiseur|BTU|clim/i.test(t)) {
          const card = a.closest('div,article,li') || a;
          const priceM = (card.innerText||'').match(/CHF\s?\d[\d'’.]*/);
          out.push({ name: t.slice(0,80), price: priceM?priceM[0]:'', href: a.href });
        }
      });
      const seen={}; return out.filter(p=>{ if(seen[p.href])return false; seen[p.href]=1; return true; });
    });
    log('PRODUITS TROUVES:', products.length);
    for (const p of products.slice(0,40)) log(' -', p.price.padEnd(11), '|', p.name, '|', p.href.split('/product/')[1]||p.href);
  } catch (e) { log('CAT ERROR:', String(e).slice(0,200)); }
  finally { await page.close().catch(()=>{}); }
  return products;
}

async function mmPdp(p) {
  const page = await ctx.newPage();
  try {
    await page.goto(p.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2200); await accept(page); await page.waitForTimeout(900);
    const av = await availLines(page).catch(()=>'');
    log(`\n>> ${p.price} | ${p.name}\n   ${av}`);
  } catch (e) { log(`\n>> ${p.name} :: ERR ${String(e).slice(0,80)}`); }
  finally { await page.close().catch(()=>{}); }
}

async function cf() {
  const page = await ctx.newPage();
  log('\n######### CONFORAMA — re-check #########');
  try {
    await page.goto('https://www.conforama.ch/fr/climatiseur-portable-ohmex-ohm-air-9100con/product/599887', { waitUntil: 'domcontentloaded', timeout: 50000 });
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1200);
    log('OHMEX 9100CON:', await availLines(page).catch(()=>''));
    await page.goto('https://www.conforama.ch/fr/climatiseurs/category/S20307', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>{});
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1200);
    const cats = await page.evaluate(() => {
      const out=[]; document.querySelectorAll('a[href*="/product/"]').forEach(a=>{ const t=(a.innerText||'').trim(); if(t&&/clim|BTU/i.test(t)){ const c=a.closest('div,li,article')||a; const pr=(c.innerText||'').match(/\d{3}\.\d{2}/); const disp=/Disponible de suite|Disponible en|sous \d|rupture|[ée]puis|Indispo/i.exec(c.innerText||''); out.push((pr?pr[0]:'?')+' | '+t.slice(0,55)+' | '+(disp?disp[0]:'')); } });
      return [...new Set(out)].slice(0,25);
    }).catch(()=>[]);
    log('CONFORAMA CATEGORIE (prix | modele | dispo):'); cats.forEach(c=>log('  -', c));
    await page.screenshot({ path: `${OUT}/cf6.png`, fullPage: true }).catch(()=>{});
  } catch (e) { log('CF ERR:', String(e).slice(0,200)); }
  finally { await page.close().catch(()=>{}); }
}

const prods = await mmCategory();
const inBudget = prods.filter(p => { const n = parseFloat((p.price||'').replace(/[^\d.]/g,'')); return n && n>=120 && n<=380; });
log(`\n--- PDP check des ${Math.min(inBudget.length,14)} modeles en budget (120-380 CHF) ---`);
for (const p of inBudget.slice(0,14)) await mmPdp(p);
await cf();
await browser.close();
log('\n===DONE6===');
