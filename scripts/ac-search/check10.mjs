// Pass 10: fresh re-scan TODAY. MediaMarkt full category -> per-PDP price + delivery date +
// availability + rating; pickup attempt (1227 Carouge) for the 9000 candidates. Conforama re-check.
import { chromium } from 'playwright';
const log = (...a) => console.log(...a);

async function accept(page){
  for(const t of ['Autoriser tous les cookies','Tout accepter','Accepter',"J'accepte",'OK']){
    try{ const b=page.getByRole('button',{name:t,exact:false}).first();
      if(await b.isVisible({timeout:1000})){ await b.click({timeout:2000}); await page.waitForTimeout(600); return; } }catch{}
  }
}
const topAvail = (page) => page.evaluate(() => {
  const b = document.body.innerText || '';
  const cut = b.search(/Description du produit|Comparaison des alternatives|Donn[ée]es techniques|Accessoires adapt/i);
  const head = cut>0 ? b.slice(0,cut) : b.slice(0,1400);
  const r = /Livraison\s*\d[\d.]*|Disponible en ligne|Online Only|Disponible de suite|Ramasser|Malheureusement|presque [ée]puis|[ée]puis|rupture|sous \d+ jour|\(\d+\s*[ée]valuation|BTU|CHF\s?\d/i;
  return [...new Set(head.split('\n').map(s=>s.trim()).filter(s=>s && r.test(s) && s.length<85))].slice(0,11).join('  ||  ');
});

const browser = await chromium.launch({ args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ locale:'fr-CH', timezoneId:'Europe/Zurich', viewport:{width:1366,height:950},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
await ctx.addInitScript(() => { Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); });

const cat = await ctx.newPage();
log('\n######### MEDIAMARKT — rayon climatiseurs (live) #########');
let hrefs = [];
try {
  await cat.goto('https://www.mediamarkt.ch/fr/category/climatiseurs-681556.html',{waitUntil:'domcontentloaded',timeout:50000});
  await cat.waitForTimeout(3000); await accept(cat); await cat.waitForTimeout(1500);
  for(let i=0;i<5;i++){ await cat.mouse.wheel(0,2400); await cat.waitForTimeout(800); }
  hrefs = await cat.evaluate(() => {
    const s=new Set();
    document.querySelectorAll('a[href*="/product/"]').forEach(a=>{ const t=(a.innerText||'').trim(); if(t&&/climatiseur|BTU|clim/i.test(t)) s.add(a.href); });
    return [...s];
  });
  log('PDP trouvés:', hrefs.length);
} catch(e){ log('CAT ERR', String(e).slice(0,150)); }
finally { await cat.close().catch(()=>{}); }

for (const h of hrefs.slice(0,16)) {
  const page = await ctx.newPage();
  try {
    await page.goto(h,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(2200);
    const title = await page.evaluate(()=>document.querySelector('h1')?.innerText?.slice(0,70)||document.title.slice(0,70));
    log(`\n>> ${title}\n   ${await topAvail(page).catch(()=>'')}`);
  } catch(e){ log(`\n>> ${h.split('/product/')[1]} :: ERR ${String(e).slice(0,60)}`); }
  finally { await page.close().catch(()=>{}); }
}

async function pickup(label, url) {
  const page = await ctx.newPage();
  log(`\n--- RETRAIT GE :: ${label} ---`);
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(2200); await accept(page); await page.waitForTimeout(900);
    for(const lbl of ['Sélectionner un magasin','Mon magasin']){
      try{ const el=page.getByText(lbl,{exact:false}).first(); if(await el.isVisible({timeout:1500})){ await el.click({timeout:2500}); await page.waitForTimeout(1600); break; } }catch{}
    }
    try{ const inp=page.locator('[role="dialog"] input, [aria-modal="true"] input').first();
      if(await inp.isVisible({timeout:2000})){ await inp.fill('1227'); await page.waitForTimeout(2600);
        const choose = page.getByRole('button',{name:/Choisir|Sélectionner|Confirmer|Carouge/i}).first();
        if(await choose.isVisible({timeout:1500})){ await choose.click({timeout:2000}); await page.waitForTimeout(2500); }
      } }catch{}
    const dlg = await page.evaluate(()=>{ const d=document.querySelector('[role="dialog"],[aria-modal="true"]'); return (d?d.innerText:'').slice(0,1400); }).catch(()=>'');
    const pick = await page.evaluate(()=>{ const r=/Carouge|Meyrin|Disponible|Indisponible|en stock|Retrait|Ramasser|Enl[eè]vement/i;
      return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<80))].slice(0,12).join(' || '); }).catch(()=>'');
    log('DIALOG:', dlg.replace(/\n+/g,' | ').slice(0,500));
    log('ETAT:', pick);
  } catch(e){ log('ERR', String(e).slice(0,150)); }
  finally { await page.close().catch(()=>{}); }
}
await pickup('DREAME P-Wind10-C 9000', 'https://www.mediamarkt.ch/fr/product/_dreame-p-wind10-c-led-display-camel-gold-max-raumgrosse-33-m-eek-a-2291187.html');
await pickup('KOENIC 9022 W CH WLAN', 'https://www.mediamarkt.ch/fr/product/_koenic-kac-9022-w-ch-wi-fi-2099464.html');

const cf = await ctx.newPage();
log('\n######### CONFORAMA — re-check #########');
try {
  await cf.goto('https://www.conforama.ch/fr/climatiseur-portable-ohmex-ohm-air-9100con/product/599887',{waitUntil:'domcontentloaded',timeout:50000});
  await cf.waitForTimeout(2500); await accept(cf); await cf.waitForTimeout(1200);
  const o = await cf.evaluate(()=>{ const r=/Disponible de suite|Disponible en|Livraison|Retrait imm|magasin|rupture|[ée]puis|sous \d/i;
    return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<85))].slice(0,8).join('  ||  '); }).catch(()=>'');
  log('OHMEX 9100CON:', o);
  try{ const bc=cf.getByRole('link',{name:/^Climatiseurs$/i}).first(); if(await bc.isVisible({timeout:1500})){ await bc.click({timeout:2500}); await cf.waitForTimeout(2500);} }catch{}
  const cats = await cf.evaluate(()=>{ const out=[];
    document.querySelectorAll('a[href*="/product/"]').forEach(a=>{ const t=(a.innerText||'').trim(); if(t&&/clim|BTU/i.test(t)){ const c=a.closest('div,li,article')||a; const pr=(c.innerText||'').match(/\d{3}\.\d{2}/); const d=/Disponible de suite|sous \d|rupture|[ée]puis|Indispo/i.exec(c.innerText||''); out.push((pr?pr[0]:'?')+' | '+t.slice(0,48)+' | '+(d?d[0]:'')); } });
    return [...new Set(out)].slice(0,20); }).catch(()=>[]);
  log('CONFORAMA climatiseurs:'); cats.forEach(c=>log('  -',c));
} catch(e){ log('CF ERR', String(e).slice(0,150)); }
finally { await cf.close().catch(()=>{}); }

await browser.close();
log('\n===DONE10===');
