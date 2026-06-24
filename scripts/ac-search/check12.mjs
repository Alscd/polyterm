// Pass 12: reproduce the user's flow — set CP 1225 via "Modifier le code postal", then read
// the MEYRIN line + 1225 delivery for every in-budget Conforama 9000-10000 BTU unit.
import { chromium } from 'playwright';
const log = (...a) => console.log(...a);
async function accept(page){
  for(const t of ['Autoriser tous les cookies','Tout accepter','Accepter',"J'accepte",'OK']){
    try{ const b=page.getByRole('button',{name:t,exact:false}).first();
      if(await b.isVisible({timeout:1200})){ await b.click({timeout:2000}); await page.waitForTimeout(700); return; } }catch{}
  }
}

const browser = await chromium.launch({ args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ locale:'fr-CH', timezoneId:'Europe/Zurich', viewport:{width:1366,height:1100},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
await ctx.addInitScript(()=>{ Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); });

const c0 = await ctx.newPage();
let products = [];
try {
  await c0.goto('https://www.conforama.ch/fr/climatiseur-portable-ohmex-ohm-air-9100con/product/599887',{waitUntil:'domcontentloaded',timeout:50000});
  await c0.waitForTimeout(2500); await accept(c0); await c0.waitForTimeout(1000);
  const catHref = await c0.evaluate(()=>{ const a=[...document.querySelectorAll('a')].find(x=>x.textContent.trim()==='Climatiseurs'); return a?a.href:''; });
  log('CAT URL:', catHref);
  if (catHref) {
    await c0.goto(catHref,{waitUntil:'domcontentloaded',timeout:45000});
    await c0.waitForTimeout(2500); await accept(c0); await c0.waitForTimeout(1200);
    for(let i=0;i<4;i++){ await c0.mouse.wheel(0,2200); await c0.waitForTimeout(700); }
    products = await c0.evaluate(()=>{ const out=[]; const seen={};
      document.querySelectorAll('a[href*="/product/"]').forEach(a=>{ const t=(a.innerText||'').replace(/\s+/g,' ').trim();
        if(t && /clim|BTU|OHM-AIR|ALPES|HY-CLM/i.test(t) && !seen[a.href]){ seen[a.href]=1; out.push({name:t.slice(0,55), href:a.href}); } });
      return out; });
  }
  log('PRODUITS:', products.length);
  products.forEach(p=>log('  -', p.name, '|', p.href));
} catch(e){ log('CAT ERR', String(e).slice(0,160)); }
finally { await c0.close().catch(()=>{}); }

async function confo1225(label, url) {
  const page = await ctx.newPage();
  log(`\n######### ${label} #########`);
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:50000});
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1000);
    try{ const d=page.getByText('Disponibilité',{exact:false}).first(); await d.scrollIntoViewIfNeeded({timeout:3000}); await page.waitForTimeout(800);}catch{}
    let opened=false;
    for(const lbl of ['Modifier le code postal','Modifier le magasin favori']){
      try{ const el=page.getByText(lbl,{exact:false}).first(); if(await el.isVisible({timeout:1500})){ await el.click({timeout:2500}); await page.waitForTimeout(1500); opened=true; break; } }catch{}
    }
    if(opened){
      try{ const inp=page.locator('input[type="text"],input[type="search"],input:not([type]),[role="dialog"] input').first();
        if(await inp.isVisible({timeout:2000})){ await inp.fill('1225'); await page.waitForTimeout(700);
          await page.keyboard.press('Enter').catch(()=>{}); await page.waitForTimeout(1200);
          for(const nm of [/Valider/i,/Confirmer/i,/Appliquer/i,/OK/i,/Rechercher/i]){ try{const b=page.getByRole('button',{name:nm}).first(); if(await b.isVisible({timeout:800})){ await b.click({timeout:1500}); await page.waitForTimeout(1500); break; }}catch{} }
          await page.waitForTimeout(2500);
        } }catch(e){ log('npa err', String(e).slice(0,80)); }
    }
    const disp = await page.evaluate(()=>{
      const b=document.body.innerText||''; const i=b.search(/Disponibilit[ée]/);
      const seg = i>=0? b.slice(i, i+1600): '';
      return seg;
    }).catch(()=>'');
    const meyrin = (disp.match(/MEYRIN\s*:?\s*([^\n]*)/i)||[])[1] || (disp.match(/Meyrin[\s\S]{0,40}?(En stock|Non disponible|Plus que[^\n]*)/i)||[])[1] || '??';
    const livr = (disp.match(/Livraison à 1225[\s\S]{0,160}/i)||disp.match(/Exp[ée]dition[\s\S]{0,120}/i)||[''])[0].replace(/\n+/g,' ').slice(0,160);
    log('LIVRAISON 1225:', livr);
    log('MEYRIN:', meyrin.trim());
    const ge = [...disp.matchAll(/(MEYRIN|GEN[EÈ]VE|VERNIER|CAROUGE|NYON|BUSSIGNY|VILLENEUVE|CONTHEY)\s*:?\s*(En stock|Non disponible|Plus que[^\n]*)/ig)].map(m=>`${m[1]}=${m[2]}`);
    log('GE/Romandie:', ge.join('  ||  ') || '(non listé)');
  } catch(e){ log('ERR', String(e).slice(0,150)); }
  finally { await page.close().catch(()=>{}); }
}

const targets = [['OHMEX OHM-AIR-9100CON 9000 (279.95) [contrôle]','https://www.conforama.ch/fr/climatiseur-portable-ohmex-ohm-air-9100con/product/599887']];
for (const p of products) {
  if (/ALPES9\b|OHM-AIR-10100|HY-CLM10BTU|ALPES9/i.test(p.name) && targets.length<6) targets.push([p.name, p.href]);
}
log('\nCIBLES:', targets.map(t=>t[0]).join(' ; '));
for (const [l,u] of targets) await confo1225(l,u);

await browser.close();
log('\n===DONE12===');
