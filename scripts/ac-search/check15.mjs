// Pass 15: quiet premium tier (budget 500-600). Live price + delivery date + dB for the
// Electrolux Comfort 600 variants (MediaMarkt + Conforama) and a couple quiet alternatives.
import { chromium } from 'playwright';
const log = (...a) => console.log(...a);
async function accept(page){
  for(const t of ['Autoriser tous les cookies','Tout accepter','Accepter',"J'accepte",'OK']){
    try{ const b=page.getByRole('button',{name:t,exact:false}).first();
      if(await b.isVisible({timeout:1200})){ await b.click({timeout:2000}); await page.waitForTimeout(700); return; } }catch{}
  }
}
const browser = await chromium.launch({ args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ locale:'fr-CH', timezoneId:'Europe/Zurich', viewport:{width:1366,height:1000},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
await ctx.addInitScript(()=>{ Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); });

async function mm(label, url) {
  const page = await ctx.newPage();
  log(`\n######### MM :: ${label} #########`);
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:50000});
    await page.waitForTimeout(2300); await accept(page); await page.waitForTimeout(900);
    const top = await page.evaluate(()=>{ const b=document.body.innerText||'';
      const cut=b.search(/Description du produit|Comparaison|Donn[ée]es techniques/i); const h=cut>0?b.slice(0,cut):b.slice(0,1300);
      const r=/CHF\s?\d|Livraison\s*\d|Disponible en ligne|Online Only|Malheureusement|presque [ée]puis|Ramasser|\(\d+\s*[ée]valuation|au lieu de|[ée]conomis/i;
      return [...new Set(h.split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<70))].slice(0,10).join('  ||  '); }).catch(()=>'');
    log('PRIX/DISPO:', top);
    for(let i=0;i<5;i++){ await page.mouse.wheel(0,2200); await page.waitForTimeout(600); }
    const db = await page.evaluate(()=>{ const r=/acoustique|sonore|dB|silenc|nuit|sleep|R290|BTU|Classe|kg|WLAN|Wi-?Fi|app/i;
      return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<70))].slice(0,16).join('  ||  '); }).catch(()=>'');
    log('SPECS/dB:', db);
  } catch(e){ log('ERR', String(e).slice(0,140)); }
  finally { await page.close().catch(()=>{}); }
}

await mm('Electrolux Comfort 600 EXP26U339CW (~587, 40m², 9000)', 'https://www.mediamarkt.ch/fr/product/_electrolux-exp26u339cw-confort-600-btu-9000-40m%C2%B2-2231348.html');
await mm('Electrolux Comfort 600 EXP26U759CW (9000)', 'https://www.mediamarkt.ch/fr/product/_electrolux-exp26u759cw-comfort-600-btu-9000-2171493.html');
await mm('Electrolux Comfort 700 ECU7678CSW (ref dB, 797)', 'https://www.mediamarkt.ch/fr/product/_electrolux-ecu7678csw-comfort-700-portables-klimagerat-weiss-max-raumgrosse-35-m-eek-a-2286771.html');
await mm('Olimpia Dolceclima 10 HP (499, WiFi, 51dB min)', 'https://www.mediamarkt.ch/fr/product/_olimpia-splendid-dolceclima-10-hp-climatiseur-mobile-avec-fonction-chauffage-2600-w-10000-btu-35m2-wifi-klimagerat-weiss-max-taille-de-la-piece-35-m-eek-a-175530213.html');

const cf = await ctx.newPage();
log('\n######### CONFORAMA :: Electrolux EXP26U339HW (599.95) #########');
try {
  await cf.goto('https://www.conforama.ch/fr/climatiseur-electrolux-exp26u339hw/product/617899',{waitUntil:'domcontentloaded',timeout:50000});
  await cf.waitForTimeout(2500); await accept(cf); await cf.waitForTimeout(1000);
  log('DISPO:', (await cf.evaluate(()=>{ const r=/Disponible de suite|Expédition|Livraison|Retrait imm|rupture|épuis|\d{3}\.\d{2}/i;
    return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<80))].slice(0,8).join('  ||  '); }).catch(()=>'')));
  for(let a=0;a<3;a++){ try{ const h=cf.getByText('Disponibilité',{exact:true}).first(); if(await h.isVisible({timeout:1500})){ await h.scrollIntoViewIfNeeded().catch(()=>{}); await h.click({timeout:2000}); await cf.waitForTimeout(1400);} }catch{}
    if(await cf.evaluate(()=>/MEYRIN|En stock|Non disponible/i.test(document.body.innerText||'')).catch(()=>false)) break; }
  const disp = await cf.evaluate(()=>{ const b=document.body.innerText||''; const i=b.search(/Disponibilit[ée]/); return i>=0?b.slice(i,i+1400):''; }).catch(()=>'');
  const meyrin=(disp.match(/MEYRIN\s*:?\s*\n?\s*(En stock|Non disponible|Plus que[^\n]*)/i)||[])[1]||'??';
  const livr=(disp.match(/Exp[ée]dition[\s\S]{0,90}/i)||[''])[0].replace(/\n+/g,' ').slice(0,110);
  log('MEYRIN:', meyrin, '| LIVRAISON:', livr);
} catch(e){ log('CF ERR', String(e).slice(0,140)); }
finally { await cf.close().catch(()=>{}); }

await browser.close();
log('\n===DONE15===');
