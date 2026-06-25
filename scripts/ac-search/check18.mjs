// Pass 18: re-scan requested retailers. Conforama (works), toppreise OFFERS (aggregates Fust/
// Galaxus/Interdiscount/Brack/Microspot stock+price), + direct attempts on the blocked ones + Amazon.
import { chromium } from 'playwright';
const log = (...a) => console.log(...a);
async function accept(page){
  for(const t of ['Autoriser tous les cookies','Tout accepter','Accepter','Accepter et fermer','Continuer sans accepter',"J'accepte",'Zustimmen','Einverstanden','OK','Accept all']){
    try{ const b=page.getByRole('button',{name:t,exact:false}).first(); if(await b.isVisible({timeout:900})){ await b.click({timeout:1500}); await page.waitForTimeout(500); return; } }catch{}
  }
}
const BLOCK=/Access Denied|datadome|captcha|unusual traffic|verify you are human|Request unsuccessful|To discuss automated/i;
const browser = await chromium.launch({ args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ locale:'fr-CH', timezoneId:'Europe/Zurich', viewport:{width:1440,height:1050},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
await ctx.addInitScript(()=>{ Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); });

async function offers(label, url){
  const page=await ctx.newPage(); log(`\n#### TOPPREISE OFFRES :: ${label} ####`);
  try{
    if(url.includes('browse')){ await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000}); await page.waitForTimeout(2200); await accept(page); await page.waitForTimeout(1200);
      const link=await page.evaluate(()=>{ const a=[...document.querySelectorAll('a[href*="/price-comparison/"]')].find(x=>/-p\d+/.test(x.href)); return a?a.href:''; }).catch(()=>''); if(link) url=link; }
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000}); await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1500);
    for(let i=0;i<5;i++){ await page.mouse.wheel(0,1500); await page.waitForTimeout(500); }
    const data=await page.evaluate(()=>{
      const shopRe=/Galaxus|Fust|Brack|Microspot|Interdiscount|MediaMarkt|Digitec|Nettoshop|Steg|Manor|melectronics|Conforama|Daydeal|Jumbo|Coop|Ackermann|STEG/i;
      const shops=[...new Set([...document.querySelectorAll('img[alt]')].map(i=>i.alt.trim()).filter(a=>shopRe.test(a)))].slice(0,12);
      const rows=[]; document.querySelectorAll('a,tr,li,div').forEach(el=>{ const t=(el.innerText||'').replace(/\s+/g,' ').trim();
        if(t&&t.length<130&&/CHF\s?\d/.test(t)&&/(En stock|disponible|jour|Sur commande|Lager|Lieferbar|imm[ée]diat|stock|Livr)/i.test(t)) rows.push(t); });
      return {shops, rows:[...new Set(rows)].slice(0,12)};
    }).catch(()=>({shops:[],rows:[]}));
    log('REVENDEURS:', data.shops.join(', ')||'(n/a)');
    log('OFFRES (prix+stock):'); data.rows.forEach(r=>log('  •',r));
  }catch(e){ log('ERR',String(e).slice(0,120)); } finally{ await page.close().catch(()=>{}); }
}
await offers('Electrolux Comfort 600 EXP26U339CW (39 dB)','https://www.toppreise.ch/browse?q=Electrolux+EXP26U339CW');
await offers('De Longhi PAC EX93 (42 dB)','https://www.toppreise.ch/price-comparison/Air-conditioners/DELONGHI-Pinguino-PAC-EX93-Extreme-0151454028-p775026');
await offers('De Longhi PAC EX130 CST WIFI','https://www.toppreise.ch/price-comparison/Air-conditioners/DELONGHI-Pinguino-PAC-EX130-CST-WIFI-p810997');

async function conf(){
  const page=await ctx.newPage(); log('\n#### CONFORAMA :: Electrolux 339HW + category ####');
  try{ await page.goto('https://www.conforama.ch/fr/climatiseur-electrolux-exp26u339hw/product/617899',{waitUntil:'domcontentloaded',timeout:45000}); await page.waitForTimeout(2300); await accept(page); await page.waitForTimeout(900);
    log('ELX-339HW:', (await page.evaluate(()=>{ const r=/Disponible de suite|Exp[ée]dition|Retrait imm|rupture|[ée]puis|\d{3}\.\d{2}|Livraison/i;
      return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<80))].slice(0,6).join('  ||  '); }).catch(()=>'')));
  }catch(e){ log('ERR',String(e).slice(0,100)); } finally{ await page.close().catch(()=>{}); }
}
await conf();

async function direct(name, home, url, locale='fr-FR'){
  const c=await browser.newContext({ locale, timezoneId:'Europe/Zurich', viewport:{width:1366,height:900},
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
  await c.addInitScript(()=>{ Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); });
  const page=await c.newPage(); log(`\n#### DIRECT :: ${name} ####`);
  try{
    if(home){ await page.goto(home,{waitUntil:'domcontentloaded',timeout:25000}).catch(()=>{}); await page.waitForTimeout(1500); await accept(page); }
    const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:28000}); const st=r&&r.status();
    await page.waitForTimeout(2000); await accept(page); await page.waitForTimeout(1200);
    const title=await page.title().catch(()=>''); const body=await page.evaluate(()=>document.body?document.body.innerText:'').catch(()=>'');
    if(BLOCK.test(body+title)||[403,429,503].includes(st)||(body||'').length<250){ log(`HTTP ${st} => BLOQUÉ/vide (${title.slice(0,40)})`); await c.close(); return; }
    const cards=await page.evaluate(()=>{ const out=[],seen=new Set();
      document.querySelectorAll('a').forEach(a=>{ const t=(a.innerText||'').replace(/\s+/g,' ').trim();
        if(t&&/clim|BTU/i.test(t)&&t.length>8&&t.length<90){ const c=a.closest('article,li,div')||a; const pr=((c.innerText||'').match(/\d[\d  .]*[,.]\d{2}\s*[€]|CHF\s?\d[\d.]*|[€]\s?\d[\d.,]*/)||[''])[0]; const k=t.slice(0,40); if(!seen.has(k)){seen.add(k);out.push((pr||'?')+' :: '+t.slice(0,55));} } });
      return out.slice(0,12); }).catch(()=>[]);
    log(`HTTP ${st} OK. Produits:`); if(cards.length) cards.forEach(x=>log('  -',x)); else log('  (page chargée, pas de cartes lues)');
  }catch(e){ log('ERR',String(e).slice(0,90)); } finally{ await c.close().catch(()=>{}); }
}
await direct('FUST','https://www.fust.ch/fr','https://www.fust.ch/fr/search/?text=climatiseur+mobile','fr-CH');
await direct('JUMBO','https://www.jumbo.ch/fr','https://www.jumbo.ch/fr/search/?text=climatiseur','fr-CH');
await direct('INTERDISCOUNT','https://www.interdiscount.ch/fr','https://www.interdiscount.ch/fr/search?query=climatiseur+mobile','fr-CH');
await direct('GALAXUS','https://www.galaxus.ch/fr','https://www.galaxus.ch/fr/search?q=climatiseur+mobile+silencieux','fr-CH');
await direct('AMAZON.DE','https://www.amazon.de','https://www.amazon.de/s?k=Electrolux+Comfort+600+mobile+Klimaanlage','de-DE');
await direct('AMAZON.FR','https://www.amazon.fr','https://www.amazon.fr/s?k=De%27Longhi+Pinguino+PAC+EX93','fr-FR');

await browser.close();
log('\n===DONE18===');
