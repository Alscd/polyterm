// Pass 19: Brack.ch (where Comfort 600 is listed) + Amazon.de (reachable) — real price + stock + delivery.
import { chromium } from 'playwright';
const log = (...a) => console.log(...a);
async function accept(page){
  for(const t of ['Tout accepter','Accepter','Alle akzeptieren','Akzeptieren','Zustimmen','Einverstanden',"J'accepte",'Cookies zulassen','OK','Accept all']){
    try{ const b=page.getByRole('button',{name:t,exact:false}).first(); if(await b.isVisible({timeout:900})){ await b.click({timeout:1500}); await page.waitForTimeout(500); return; } }catch{}
  }
}
const BLOCK=/Access Denied|datadome|captcha|verify you are human|Request unsuccessful|Toutes nos excuses|Tut uns leid|automated access/i;
const browser = await chromium.launch({ args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });

async function newP(locale){ const c=await browser.newContext({ locale, timezoneId:'Europe/Zurich', viewport:{width:1440,height:1000},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
  await c.addInitScript(()=>{ Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); }); return [c, await c.newPage()]; }

async function brack(label, query){
  const [c,page]=await newP('fr-CH'); log(`\n#### BRACK.CH :: ${label} ####`);
  try{
    await page.goto('https://www.brack.ch/search?query='+encodeURIComponent(query),{waitUntil:'domcontentloaded',timeout:35000});
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1500);
    for(let i=0;i<3;i++){ await page.mouse.wheel(0,1800); await page.waitForTimeout(700); }
    const title=await page.title().catch(()=>''); const body=await page.evaluate(()=>document.body?document.body.innerText:'').catch(()=>'');
    if(BLOCK.test(body+title)||body.length<200){ log('=> BLOQUÉ/vide:', title.slice(0,50)); await c.close(); return; }
    const cards=await page.evaluate(()=>{ const out=[],seen=new Set();
      document.querySelectorAll('a[href]').forEach(a=>{ const t=(a.innerText||'').replace(/\s+/g,' ').trim();
        if(t&&/clim|BTU|Comfort 600|EX93|Pinguino/i.test(t)&&t.length>6&&t.length<90){ const cc=a.closest('article,li,div')||a; const pr=((cc.innerText||'').match(/CHF\s?\d[\d'’.]*|\d[\d'’]*\.\d{2}/)||[''])[0]; const stock=((cc.innerText||'').match(/Livrable|En stock|lieferbar|An Lager|jour|imm[ée]diat|rupture|[ée]puis|stock/i)||[''])[0]; const k=t.slice(0,40); if(!seen.has(k)){seen.add(k);out.push((pr||'?')+' | '+(stock||'')+' | '+t.slice(0,50));} } });
      return out.slice(0,10); }).catch(()=>[]);
    if(cards.length) cards.forEach(x=>log('  -',x)); else log('  (chargé, pas de cartes lues)');
  }catch(e){ log('ERR',String(e).slice(0,90)); } finally{ await c.close().catch(()=>{}); }
}

async function amazon(label, query){
  const [c,page]=await newP('de-DE'); log(`\n#### AMAZON.DE :: ${label} ####`);
  try{
    await page.goto('https://www.amazon.de/s?k='+encodeURIComponent(query),{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1500);
    const title=await page.title().catch(()=>''); const body=await page.evaluate(()=>document.body?document.body.innerText:'').catch(()=>'');
    if(BLOCK.test(body+title)||body.length<200){ log('=> BLOQUÉ:', title.slice(0,50)); await c.close(); return; }
    const cards=await page.evaluate(()=>{ const out=[];
      document.querySelectorAll('div[data-component-type="s-search-result"]').forEach(d=>{ const t=(d.querySelector('h2')?.innerText||'').replace(/\s+/g,' ').trim(); const pr=(d.querySelector('.a-price .a-offscreen')?.textContent||'').trim(); if(t&&/clim|Klima|BTU|Comfort|Pinguino|EX93/i.test(t)) out.push((pr||'?')+' | '+t.slice(0,60)); });
      return out.slice(0,10); }).catch(()=>[]);
    if(cards.length) cards.forEach(x=>log('  -',x)); else log('  (chargé, 0 résultat parsé)');
  }catch(e){ log('ERR',String(e).slice(0,90)); } finally{ await c.close().catch(()=>{}); }
}

await brack('Electrolux Comfort 600','Electrolux Comfort 600');
await brack('De Longhi Pinguino EX93','De Longhi Pinguino EX93');
await amazon('Electrolux Comfort 600 Klimaanlage','Electrolux Comfort 600 mobile Klimaanlage');
await amazon('De Longhi Pinguino PAC EX93','De Longhi Pinguino PAC EX93');
await browser.close();
log('\n===DONE19===');
