// Pass 17: on toppreise.ch, open the product page for the quiet models and list which
// retailer has stock + price + delivery (the offers table).
import { chromium } from 'playwright';
const log = (...a) => console.log(...a);
async function accept(page){
  for(const t of ['Tout accepter','Accepter','Zustimmen','Einverstanden','OK','Accept all',"J'accepte"]){
    try{ const b=page.getByRole('button',{name:t,exact:false}).first(); if(await b.isVisible({timeout:1000})){ await b.click({timeout:1500}); await page.waitForTimeout(500); return; } }catch{}
  }
}
const SHOPS=/MediaMarkt|Conforama|Fust|Galaxus|Digitec|Interdiscount|Brack|Microspot|Nettoshop|Steg|melectronics|Manor|Daydeal|toppreise|Coop|Jumbo|Ackermann|Quelle/i;

const browser = await chromium.launch({ args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ locale:'fr-CH', timezoneId:'Europe/Zurich', viewport:{width:1440,height:1100},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
await ctx.addInitScript(()=>{ Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); });

async function offers(label, query) {
  const page = await ctx.newPage();
  log(`\n######### ${label} #########`);
  try {
    await page.goto('https://www.toppreise.ch/browse?q='+encodeURIComponent(query),{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1500);
    const link = await page.evaluate(()=>{ const a=[...document.querySelectorAll('a[href*="/price-comparison/"]')].find(x=>/-p\d+/.test(x.href)); return a?a.href:''; }).catch(()=>'');
    log('PRODUIT:', link||'(pas trouvé)');
    if(!link){ await page.close(); return; }
    await page.goto(link,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1500);
    for(let i=0;i<4;i++){ await page.mouse.wheel(0,1800); await page.waitForTimeout(600); }
    const rows = await page.evaluate((shopSrc)=>{
      const shop=new RegExp(shopSrc,'i');
      const out=[];
      document.querySelectorAll('tr, li, div').forEach(el=>{
        const t=(el.innerText||'').replace(/\s+/g,' ').trim();
        if(t && t.length<120 && shop.test(t) && /CHF\s?\d/.test(t)) out.push(t);
      });
      return [...new Set(out)].slice(0,16);
    }, SHOPS.source).catch(()=>[]);
    if(rows.length){ rows.forEach(r=>log('  •',r)); }
    else {
      const fl = await page.evaluate(()=>{ const r=/CHF\s?\d|En stock|disponible|Livr|jours|stock|Sofort|Lager|imm[ée]diat/i;
        return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<70))].slice(0,18); }).catch(()=>[]);
      fl.forEach(l=>log('  -',l));
    }
  } catch(e){ log('ERR', String(e).slice(0,140)); }
  finally { await page.close().catch(()=>{}); }
}

await offers('Electrolux Comfort 600 EXP26U339CW (47/39 dB, ~566)', 'Electrolux EXP26U339CW');
await offers('De Longhi Pinguino PAC EX130 CST WIFI (Silent)', 'De Longhi PAC EX130 CST WIFI');
await offers('De Longhi PAC EX93 (42 dB nuit)', 'De Longhi PAC EX93');

await browser.close();
log('\n===DONE17===');
