// Pass 9: nail the DREAME delivery date (top availability block only, no comparison bleed).
import { chromium } from 'playwright';
const log = (...a) => console.log(...a);

async function accept(page){
  for(const t of ['Tout accepter','Accepter',"J'accepte",'OK']){
    try{ const b=page.getByRole('button',{name:t,exact:false}).first();
      if(await b.isVisible({timeout:1000})){ await b.click({timeout:2000}); await page.waitForTimeout(500); return; } }catch{}
  }
}

const top = (page) => page.evaluate(() => {
  const b = document.body.innerText || '';
  const cut = b.search(/Description du produit|Comparaison des alternatives|Donn[ée]es techniques|Accessoires adapt/i);
  const head = (cut>0 ? b.slice(0,cut) : b.slice(0,1500));
  const r = /Livraison\s*\d[\d.]*|Disponible en ligne|Online Only|Ramasser|Malheureusement|presque [ée]puis|[ée]puis|rupture|sous \d+ jour|\(\d+\s*[ée]valuation|CHF\s?\d/i;
  return [...new Set(head.split('\n').map(s=>s.trim()).filter(s=>s && r.test(s) && s.length<90))].slice(0,12).join('  ||  ');
});

const browser = await chromium.launch({ args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ locale:'fr-CH', timezoneId:'Europe/Zurich', viewport:{width:1366,height:950},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
await ctx.addInitScript(() => { Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); });

const items = [
  ['DREAME P-Wind10-C 9000 CAMEL GOLD (349)', 'https://www.mediamarkt.ch/fr/product/_dreame-p-wind10-c-led-display-camel-gold-max-raumgrosse-33-m-eek-a-2291187.html'],
  ['DREAME P-Wind10 9000 BLANC (autre coloris)', 'https://www.mediamarkt.ch/fr/product/_dreame-pwind10-9000-btu-tragbare-klimaanlage-weissbeige-max-raumgrosse-33-m-eek-a-2290547.html'],
  ['Olimpia Splendid Dolceclima Slim 8WWB (321)', 'https://www.mediamarkt.ch/fr/product/_olimpia-splendid-dolceclima-slim-8wwb-climatiseur-blanc-max-taille-de-la-piece-60-m-eek-a-178561401.html'],
];
let firstP = true;
for (const [label,url] of items) {
  const page = await ctx.newPage();
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:50000});
    await page.waitForTimeout(2500); if(firstP){ await accept(page); firstP=false; await page.waitForTimeout(900); }
    log(`\n== ${label}\n   ${await top(page).catch(()=>'')}`);
  } catch(e){ log(`\n== ${label} :: ERR ${String(e).slice(0,80)}`); }
  finally { await page.close().catch(()=>{}); }
}
await browser.close();
log('\n===DONE9===');
