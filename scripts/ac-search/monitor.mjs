// AC monitor: quiet models — is it DELIVERABLE + current price + promo. Compact STATUS output.
import { chromium } from 'playwright';
const log = (...a) => console.log(...a);
async function accept(page){
  for(const t of ['Autoriser tous les cookies','Tout accepter','Accepter',"J'accepte",'Zustimmen','Einverstanden','OK']){
    try{ const b=page.getByRole('button',{name:t,exact:false}).first(); if(await b.isVisible({timeout:1000})){ await b.click({timeout:1500}); await page.waitForTimeout(500); return; } }catch{}
  }
}
const browser = await chromium.launch({ args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ locale:'fr-CH', timezoneId:'Europe/Zurich', viewport:{width:1366,height:1000},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
await ctx.addInitScript(()=>{ Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); });

async function mm(tag, url){
  const page=await ctx.newPage();
  try{
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000}); await page.waitForTimeout(2300); await accept(page); await page.waitForTimeout(800);
    const d=await page.evaluate(()=>{ const b=document.body.innerText||''; const cut=b.search(/Description du produit|Comparaison|Donn[ée]es techniques/i); const h=cut>0?b.slice(0,cut):b.slice(0,1200);
      const price=(h.match(/CHF\s?\d[\d'’]*\.?\d{0,2}/)||[''])[0];
      const noDeliv=/Malheureusement pas de livraison/i.test(h);
      const deliv=/Disponible en ligne|Livraison\s*\d/i.test(h)&&!noDeliv;
      const date=(h.match(/Livraison\s*\d[\d.]*\s*-\s*\d[\d.]*\.\d{4}/i)||h.match(/Livraison\s*\d[\d.]*/i)||[''])[0];
      const promo=/au lieu de|[ée]conomis|presque [ée]puis/i.test(h)?(h.match(/au lieu de\s*CHF?\s?\d[\d'’.]*/i)||['promo'])[0]:'';
      return {price,deliv,date,promo,noDeliv}; }).catch(()=>({}));
    log(`STATUS | ${tag} | prix=${d.price||'?'} | livrable=${d.deliv?'OUI':'non'} | ${d.date||(d.noDeliv?'pas de livraison':'')} ${d.promo||''}`);
  }catch(e){ log(`STATUS | ${tag} | ERR ${String(e).slice(0,50)}`); }
  finally{ await page.close().catch(()=>{}); }
}
async function cf(tag,url){
  const page=await ctx.newPage();
  try{ await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000}); await page.waitForTimeout(2300); await accept(page); await page.waitForTimeout(800);
    const d=await page.evaluate(()=>{ const b=document.body.innerText||'';
      const price=(b.match(/\d{3}\.\d{2}/)||[''])[0];
      const dispo=/Disponible de suite/i.test(b); const rupt=/rupture|[ée]puis/i.test(b);
      const exp=(b.match(/Exp[ée]dition[^\n]{0,40}/i)||[''])[0];
      return {price,dispo,rupt,exp}; }).catch(()=>({}));
    log(`STATUS | ${tag} | prix=${d.price||'?'} | dispo_suite=${d.dispo?'OUI':'non'} | ${d.exp||''} ${d.rupt?'(rupture)':''}`);
  }catch(e){ log(`STATUS | ${tag} | ERR ${String(e).slice(0,50)}`); }
  finally{ await page.close().catch(()=>{}); }
}
async function topp(tag,url){
  const page=await ctx.newPage();
  try{ await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000}); await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1200);
    const min=await page.evaluate(()=>{ const m=[...(document.body.innerText||'').matchAll(/CHF\s?([\d'’]{2,7})\.?\d{0,2}/g)].map(x=>parseFloat(x[1].replace(/[^\d]/g,''))).filter(n=>n>=200&&n<=1500); return m.length?Math.min(...m):0; }).catch(()=>0);
    log(`STATUS | ${tag} | prix_min_CH=CHF ${min||'?'}`);
  }catch(e){ log(`STATUS | ${tag} | ERR ${String(e).slice(0,50)}`); }
  finally{ await page.close().catch(()=>{}); }
}

log('===AC-MONITOR-START===  (cibles silencieuses)');
await mm('ELX-Comfort600-339CW(39dB nuit)','https://www.mediamarkt.ch/fr/product/_electrolux-exp26u339cw-confort-600-btu-9000-40m%C2%B2-2231348.html');
await mm('OLIMPIA-10HP(51dB,WiFi,promo)','https://www.mediamarkt.ch/fr/product/_olimpia-splendid-dolceclima-10-hp-climatiseur-mobile-avec-fonction-chauffage-2600-w-10000-btu-35m2-wifi-klimagerat-weiss-max-taille-de-la-piece-35-m-eek-a-175530213.html');
await mm('DREAME-9000(65dB,WiFi)','https://www.mediamarkt.ch/fr/product/_dreame-p-wind10-c-led-display-camel-gold-max-raumgrosse-33-m-eek-a-2291187.html');
await cf('CONFO-ELX-339HW(599)','https://www.conforama.ch/fr/climatiseur-electrolux-exp26u339hw/product/617899');
await topp('TOPP-EX93(42dB nuit)','https://www.toppreise.ch/price-comparison/Air-conditioners/DELONGHI-Pinguino-PAC-EX93-Extreme-0151454028-p775026');
await topp('TOPP-Comfort600','https://www.toppreise.ch/browse?q=Electrolux+EXP26U339CW');
log('===AC-MONITOR-END===');
await browser.close();
