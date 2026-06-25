// Pass 16: use toppreise.ch (CH price comparator) to find which retailer has stock + price for
// recent quiet models, + MediaMarkt category fresh for any quiet unit deliverable now.
import { chromium } from 'playwright';
const log = (...a) => console.log(...a);
async function accept(page){
  for(const t of ['Tout accepter','Accepter','Accepter tout',"J'accepte",'Autoriser tous les cookies','OK','Einverstanden','Zustimmen','Accept all']){
    try{ const b=page.getByRole('button',{name:t,exact:false}).first();
      if(await b.isVisible({timeout:1000})){ await b.click({timeout:1800}); await page.waitForTimeout(600); return; } }catch{}
  }
  for(const sel of ['#onetrust-accept-btn-handler','#didomi-notice-agree-button']){ try{const b=page.locator(sel).first(); if(await b.isVisible({timeout:700})){await b.click();await page.waitForTimeout(500);return;}}catch{} }
}
const BLOCK=/Access Denied|datadome|captcha|unusual traffic|verify you are human|Request unsuccessful/i;

const browser = await chromium.launch({ args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ locale:'fr-CH', timezoneId:'Europe/Zurich', viewport:{width:1440,height:1000},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
await ctx.addInitScript(()=>{ Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); });

async function topp(label, url) {
  const page = await ctx.newPage();
  log(`\n######### TOPPREISE :: ${label} #########`);
  try {
    const r = await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    log('HTTP', r&&r.status());
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1500);
    for(let i=0;i<3;i++){ await page.mouse.wheel(0,2000); await page.waitForTimeout(700); }
    const title=await page.title().catch(()=>'');
    const body=await page.evaluate(()=>document.body?document.body.innerText:'').catch(()=>'');
    if(BLOCK.test(body+title)||(r&&[403,429].includes(r.status()))||body.length<200){ log('=> BLOQUÉ. title:',title.slice(0,50)); await page.close(); return; }
    const lines = await page.evaluate(()=>{ const r=/CHF\s?\d|d[èe]s CHF|En stock|disponible|jours|Stock|Livr|MediaMarkt|Conforama|Fust|Galaxus|Interdiscount|Brack|Microspot|Nettoshop|Digitec|BTU|dB|silenc/i;
      return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<80))].slice(0,30); }).catch(()=>[]);
    lines.forEach(l=>log('  ',l));
  } catch(e){ log('ERR', String(e).slice(0,140)); }
  finally { await page.close().catch(()=>{}); }
}

await topp('De\'Longhi PAC EX130 CST WIFI (p810997)','https://www.toppreise.ch/price-comparison/Air-conditioners/DELONGHI-Pinguino-PAC-EX130-CST-WIFI-p810997');
await topp('De\'Longhi PAC EX130 Eco RealFeel (p619014)','https://www.toppreise.ch/price-comparison/Air-conditioners/DELONGHI-Pinguino-PAC-EX130-Eco-RealFeel-p619014');
await topp('Recherche: De\'Longhi PAC EX93','https://www.toppreise.ch/browse?q=de%27longhi+pac+ex93');
await topp('Recherche: Comfee climatiseur','https://www.toppreise.ch/browse?q=comfee+climatiseur');
await topp('Catégorie climatiseurs (tri prix)','https://www.toppreise.ch/price-comparison/Air-conditioners');

async function mm(label,url){
  const page=await ctx.newPage(); log(`\n##### MM :: ${label} #####`);
  try{ await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000}); await page.waitForTimeout(2300); await accept(page); await page.waitForTimeout(800);
    const top=await page.evaluate(()=>{ const b=document.body.innerText||''; const cut=b.search(/Description du produit|Comparaison|Donn[ée]es techniques/i); const h=cut>0?b.slice(0,cut):b.slice(0,1200);
      const r=/CHF\s?\d|Livraison\s*\d|Disponible en ligne|Malheureusement|presque [ée]puis|Ramasser|\(\d+\s*[ée]valuation/i;
      return [...new Set(h.split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<70))].slice(0,8).join('  ||  '); }).catch(()=>'');
    log('PRIX/DISPO:', top);
    for(let i=0;i<4;i++){ await page.mouse.wheel(0,2000); await page.waitForTimeout(500); }
    const db=await page.evaluate(()=>{ const r=/acoustique|sonore|\d+\s?dB|silenc|nuit|R290|BTU|kg|WLAN|Wi-?Fi/i;
      return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<60))].slice(0,10).join('  ||  '); }).catch(()=>'');
    log('dB/specs:', db);
  }catch(e){ log('ERR',String(e).slice(0,100)); } finally{ await page.close().catch(()=>{}); }
}
await mm('Stadler Form Emil (448.70)','https://www.mediamarkt.ch/fr/product/_stadler-form-emil-mobile-klimaanlage-weiss-max-raumgrosse-35-m-eek--2290107.html');

await browser.close();
log('\n===DONE16===');
