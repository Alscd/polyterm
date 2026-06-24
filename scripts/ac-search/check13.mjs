// Pass 13: expand the Conforama "Disponibilité" accordion and read MEYRIN pickup + store table
// + delivery line, for each in-budget 9000-10000 BTU unit. (URLs discovered in pass 12.)
import { chromium } from 'playwright';
const log = (...a) => console.log(...a);
async function accept(page){
  for(const t of ['Autoriser tous les cookies','Tout accepter','Accepter',"J'accepte",'OK']){
    try{ const b=page.getByRole('button',{name:t,exact:false}).first();
      if(await b.isVisible({timeout:1200})){ await b.click({timeout:2000}); await page.waitForTimeout(700); return; } }catch{}
  }
}
const CITIES = ['MEYRIN','GENÈVE','VERNIER','CAROUGE','NYON','BUSSIGNY','VILLENEUVE','CONTHEY','CRISSIER','GRANGES-PACCOT','BIENNE','LAUSANNE'];

const browser = await chromium.launch({ args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ locale:'fr-CH', timezoneId:'Europe/Zurich', viewport:{width:1366,height:1100},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
await ctx.addInitScript(()=>{ Object.defineProperty(navigator,'webdriver',{get:()=>undefined}); });

async function probe(label, url) {
  const page = await ctx.newPage();
  log(`\n######### ${label} #########`);
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:50000});
    await page.waitForTimeout(2500); await accept(page); await page.waitForTimeout(1000);
    const top = await page.evaluate(()=>{ const r=/Disponible de suite|Disponible en|Expédition|Retrait imm|rupture|épuis|sous \d/i;
      return [...new Set((document.body.innerText||'').split('\n').map(s=>s.trim()).filter(s=>s&&r.test(s)&&s.length<80))].slice(0,4).join(' | '); }).catch(()=>'');
    log('ETAT:', top);
    for (let attempt=0; attempt<3; attempt++){
      try{ const h=page.getByText('Disponibilité',{exact:true}).first();
        if(await h.isVisible({timeout:1500})){ await h.scrollIntoViewIfNeeded().catch(()=>{}); await h.click({timeout:2000}); await page.waitForTimeout(1500); } }catch{}
      const has = await page.evaluate(()=>/MEYRIN|ALCHENFL|En stock|Non disponible/i.test(document.body.innerText||'')).catch(()=>false);
      if (has) break;
    }
    const disp = await page.evaluate(()=>{ const b=document.body.innerText||''; const i=b.search(/Disponibilit[ée]/);
      return i>=0 ? b.slice(i, i+1700) : ''; }).catch(()=>'');
    const livr = (disp.match(/Livraison à \d{4}[\s\S]{0,140}?Modifier/i)||disp.match(/Exp[ée]dition[\s\S]{0,120}/i)||[''])[0].replace(/\n+/g,' ').replace(/\s{2,}/g,' ').slice(0,150);
    log('LIVRAISON:', livr.trim()||'(non lu)');
    const res = [];
    for (const c of CITIES){
      const m = disp.match(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*:?\\s*\\n?\\s*(En stock|Non disponible|Plus que[^\\n]*)','i'));
      if (m) res.push(`${c}=${m[1].trim()}`);
    }
    log('MAGASINS GE/Romandie:', res.join('  ||  ') || '(table non lue)');
    const enstock = (disp.match(/En stock/gi)||[]).length;
    log('Nb stores En stock (sur la page):', enstock);
  } catch(e){ log('ERR', String(e).slice(0,150)); }
  finally { await page.close().catch(()=>{}); }
}

const T = [
  ['OHMEX OHM-AIR-9100CON 9000 BTU (279.95)', 'https://www.conforama.ch/fr/climatiseur-portable-ohmex-ohm-air-9100con/product/599887'],
  ['JOHNSON ALPES9 9000 BTU (329.95)', 'https://www.conforama.ch/fr/climatiseur-johnson-alpes9/product/617835'],
  ['OHMEX OHM-AIR-10100 10000 BTU A+ (349.95)', 'https://www.conforama.ch/fr/climatiseur-portable-ohmex-ohm-air-10100/product/599888'],
  ['HYUNDAI HY-CLM10BTU-001 10000 BTU (349.95)', 'https://www.conforama.ch/fr/climatiseur-interieur-hyundai-hy-clm10btu-001/product/619858'],
];
for (const [l,u] of T) await probe(l,u);

await browser.close();
log('\n===DONE13===');
