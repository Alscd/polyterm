// Pass 11: Conforama deep — for the in-budget 9000 BTU units, confirm delivery to a 12xx
// NPA and whether Meyrin (GE store) has pickup stock. Plus Johnson ALPES9 specs.
import { chromium } from 'playwright';
const log = (...a) => console.log(...a);
async function accept(page){
  for(const t of ['Autoriser tous les cookies','Tout accepter','Accepter',"J'accepte",'OK']){
    try{ const b=page.getByRole('button',{name:t,exact:false}).first();
      if(await b.isVisible({timeout:1200})){ await b.click({timeout:2000}); await page.waitForTimeout(700); return; } }catch{}
  }
}
const lines = (page, rx) => page.evaluate((rs)=>{ const r=new RegExp(rs,'i');
  return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<95))].slice(0,22); }, rx);

const browser = await chromium.launch({ args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ locale:'fr-CH', timezoneId:'Europe/Zurich', viewport:{width:1366,height:950},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
await ctx.addInitScript(()=>{ Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); });

const c0 = await ctx.newPage();
let map = {};
try {
  await c0.goto('https://www.conforama.ch/fr/climatiseur-portable-ohmex-ohm-air-9100con/product/599887',{waitUntil:'domcontentloaded',timeout:50000});
  await c0.waitForTimeout(2500); await accept(c0); await c0.waitForTimeout(1000);
  try{ const bc=c0.getByRole('link',{name:/^Climatiseurs$/i}).first(); if(await bc.isVisible({timeout:1500})){ await bc.click({timeout:2500}); await c0.waitForTimeout(2500);} }catch{}
  map = await c0.evaluate(()=>{ const m={}; document.querySelectorAll('a[href*="/product/"]').forEach(a=>{ const t=(a.innerText||'').replace(/\s+/g,' ').trim(); if(t&&/ALPES9|9100CON|10100|HY-CLM10/i.test(t)) m[t.slice(0,40)]=a.href; }); return m; });
  log('HREFS:', JSON.stringify(map));
} catch(e){ log('CAT ERR', String(e).slice(0,150)); }
finally { await c0.close().catch(()=>{}); }

async function probe(label, url) {
  const page = await ctx.newPage();
  log(`\n######### ${label} #########`);
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:50000});
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1200);
    log('DISPO:', (await lines(page, 'Disponible de suite|Disponible en|Expédition|Livraison|Retrait imm|magasin|rupture|épuis|sous \\d').catch(()=>[])).join('  ||  '));
    for(const lbl of ['Voir les caractéristiques détaillées','Caractéristiques']){
      try{ const el=page.getByText(lbl,{exact:false}).first(); if(await el.isVisible({timeout:1500})){ await el.click({timeout:2500}); await page.waitForTimeout(1200); break; } }catch{}
    }
    log('SPECS:', (await lines(page, 'BTU|dB|R290|R-?290|[ée]nerg|classe [AÀ]|WiFi|WLAN|Wi-Fi|connect|d[ée]shumid|avis|[ée]valuation|m2|m²|vitesse|poids|kg').catch(()=>[])).slice(0,18).join('  ||  '));
    try{ const inp=page.getByPlaceholder(/code postal|postal|NPA|ville/i).first();
      if(await inp.isVisible({timeout:1500})){ await inp.fill('1225'); await page.keyboard.press('Enter').catch(()=>{}); await page.waitForTimeout(2500); log('NPA 1225 -> ', (await lines(page,'Expédition|Livraison|sous \\d|1225|Genève|retrait').catch(()=>[])).join(' || ')); } }catch{}
    for(const lbl of ['Retrait immédiat','Disponibilité','Trouver un magasin','En savoir plus']){
      try{ const el=page.getByText(lbl,{exact:false}).first(); if(await el.isVisible({timeout:1500})){ await el.scrollIntoViewIfNeeded().catch(()=>{}); await el.click({timeout:2500}); await page.waitForTimeout(2200); log('clic',lbl); break; } }catch{}
    }
    log('MAGASINS:', (await lines(page,'Meyrin|Gen[eè]ve|Vernier|Carouge|Lausanne|Etoy|Conthey|Crissier|Vésenaz|Balexert|Disponible|Indisponible|Rupture|magasin').catch(()=>[])).slice(0,18).join('  ||  '));
  } catch(e){ log('ERR', String(e).slice(0,150)); }
  finally { await page.close().catch(()=>{}); }
}

await probe('OHMEX OHM-AIR-9100CON 9000 (279.95)', 'https://www.conforama.ch/fr/climatiseur-portable-ohmex-ohm-air-9100con/product/599887');
const johnson = Object.entries(map).find(([k])=>/ALPES9/i.test(k));
if (johnson) await probe('JOHNSON ALPES9 9000 (329.95)', johnson[1]); else log('\n(JOHNSON ALPES9 href introuvable dans la catégorie)');

await browser.close();
log('\n===DONE11===');
