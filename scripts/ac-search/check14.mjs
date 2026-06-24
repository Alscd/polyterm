// Pass 14: fresh re-scan + add FR/CH retailers (Leroy Merlin, Boulanger, Darty, Fnac FR & CH).
import { chromium } from 'playwright';
const log = (...a) => console.log(...a);
async function accept(page){
  for(const t of ['Tout accepter','Accepter','Accepter et fermer','Continuer sans accepter',"J'accepte",'Autoriser tous les cookies','OK','Accepter & Fermer']){
    try{ const b=page.getByRole('button',{name:t,exact:false}).first();
      if(await b.isVisible({timeout:1000})){ await b.click({timeout:1800}); await page.waitForTimeout(600); return; } }catch{}
  }
  for(const sel of ['#onetrust-accept-btn-handler','#didomi-notice-agree-button','button[aria-label="Accepter"]']){
    try{ const b=page.locator(sel).first(); if(await b.isVisible({timeout:700})){ await b.click(); await page.waitForTimeout(500); return; } }catch{}
  }
}
const BLOCK=/Access Denied|datadome|Pardon Our|unusual traffic|captcha|verify you are human|robot|Request unsuccessful|bloqu/i;

const browser = await chromium.launch({ args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
async function newPage(locale){
  const ctx = await browser.newContext({ locale, timezoneId:'Europe/Paris', viewport:{width:1366,height:950},
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    extraHTTPHeaders:{'Accept-Language': locale+',fr;q=0.9,en;q=0.8'} });
  await ctx.addInitScript(()=>{ Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); });
  return [ctx, await ctx.newPage()];
}

async function scanFR(name, home, url, locale='fr-FR') {
  const [ctx,page] = await newPage(locale);
  log(`\n######### ${name} #########`);
  try {
    await page.goto(home,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});
    await page.waitForTimeout(1800); await accept(page); await page.waitForTimeout(1000);
    const r = await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    log('HTTP', r&&r.status());
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1200);
    for(let i=0;i<3;i++){ await page.mouse.wheel(0,2200); await page.waitForTimeout(800); }
    const title = await page.title().catch(()=>'');
    const body = await page.evaluate(()=>document.body?document.body.innerText:'').catch(()=>'');
    if (BLOCK.test(body+' '+title) || (r&&[403,429].includes(r.status())) || (body||'').length<200) { log('=> BLOQUÉ / vide. title:', title.slice(0,60)); await ctx.close(); return; }
    const cards = await page.evaluate(()=>{
      const out=[]; const seen=new Set();
      document.querySelectorAll('a').forEach(a=>{ const t=(a.innerText||'').replace(/\s+/g,' ').trim();
        if(t && /clim|BTU/i.test(t) && t.length>8 && t.length<95){
          const c=a.closest('article,li,div')||a;
          const pr=((c.innerText||'').match(/\d[\d  .]*[,.]\d{2}\s*€|€\s*\d[\d  .]*\d|CHF\s?\d[\d.]*/)||[''])[0];
          const k=t.slice(0,42); if(!seen.has(k)){ seen.add(k); out.push((pr||'?')+'  ::  '+t.slice(0,62)); } }
      });
      return out.slice(0,16);
    }).catch(()=>[]);
    log('PRODUITS:'); if(cards.length) cards.forEach(c=>log('  -',c)); else log('  (aucune carte lue)');
    const av = await page.evaluate(()=>{ const r=/disponible|en stock|retrait|click|collect|livraison|2h|1h|rupture|[ée]puis/i;
      return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<70))].slice(0,6).join('  ||  '); }).catch(()=>'');
    log('DISPO (générique):', av);
  } catch(e){ log('ERR', String(e).slice(0,140)); }
  finally { await ctx.close().catch(()=>{}); }
}

async function swissQuick(name,url){
  const [ctx,page]=await newPage('fr-CH');
  try{ await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000}); await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(900);
    const t=await page.evaluate(()=>{ const r=/Disponible en ligne|Disponible de suite|Livraison\s*\d|Malheureusement|presque [ée]puis|Retrait imm|rupture|pas de livraison/i;
      return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<70))].slice(0,5).join(' | '); }).catch(()=>'');
    log(`\n[CH] ${name}: ${t}`);
  }catch(e){ log(`[CH] ${name} ERR`, String(e).slice(0,80)); } finally{ await ctx.close().catch(()=>{}); }
}
log('######### RE-CHECK SUISSE #########');
await swissQuick('DREAME P-Wind10-C 9000 (MediaMarkt 349)','https://www.mediamarkt.ch/fr/product/_dreame-p-wind10-c-led-display-camel-gold-max-raumgrosse-33-m-eek-a-2291187.html');
await swissQuick('OHMEX 9100CON 9000 (Conforama 279.95)','https://www.conforama.ch/fr/climatiseur-portable-ohmex-ohm-air-9100con/product/599887');

await scanFR('LEROY MERLIN (FR)','https://www.leroymerlin.fr','https://www.leroymerlin.fr/produits/chauffage-plomberie/climatiseur-rafraichisseur-et-ventilateur/climatiseur/climatiseur-mobile/');
await scanFR('BOULANGER (FR)','https://www.boulanger.com','https://www.boulanger.com/c/climatiseur-mobile');
await scanFR('DARTY (FR)','https://www.darty.com','https://www.darty.com/nav/achat/gros_electromenager/chauffage_climatisation/climatiseur/climatiseur_mobile.html');
await scanFR('FNAC (FR)','https://www.fnac.com','https://www.fnac.com/SearchResult/ResultList.aspx?Search=climatiseur+mobile+9000+BTU');
await scanFR('FNAC SUISSE (.ch, magasins Genève)','https://www.fr.fnac.ch','https://www.fr.fnac.ch/SearchResult/ResultList.aspx?Search=climatiseur+mobile', 'fr-CH');

await browser.close();
log('\n===DONE14===');
