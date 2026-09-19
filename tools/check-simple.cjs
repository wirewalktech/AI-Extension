const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');
(async()=>{
const browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const catalog=await fetch('https://wirewalk-orders.wirewalk-upload.workers.dev/catalog?practice=ai').then(r=>r.json());
const base=process.env.SIMPLE_BASE || 'http://127.0.0.1:8769';
await page.route('**/catalog?practice=ai',r=>r.fulfill({json:catalog}));
const routes=['','services/','pricing/','industries/','industries/construction/','how-it-works/','contact/'];
for(const width of [390,768,1440]){await page.setViewportSize({width,height:950});for(const route of routes){await page.goto(base+'/simple/'+route);if(route==='pricing/')await page.waitForSelector('[data-sku]');const over=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(over)throw Error('Overflow '+width+' '+route);const collisions=await page.locator('header a').evaluateAll(els=>els.flatMap((a,i)=>els.slice(i+1).filter(b=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return Math.min(x.right,y.right)-Math.max(x.left,y.left)>2&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2})).length);if(collisions)throw Error('Header collision');}
console.log('PASS responsive pages at '+width+'px');}
await page.goto(base+'/simple/pricing/');await page.waitForSelector('[data-sku]');
for(const i of catalog.items){const row=page.locator('[data-sku="'+i.sku+'"]');if(await row.count()!==1)throw Error('Missing SKU '+i.sku);if(await row.locator('.price').textContent()!==(i.priceOnApplication?'Custom quote':i.listFormatted))throw Error('Price drift');if(await row.locator('a').getAttribute('href')!=='/order/?sku='+i.sku)throw Error('Wrong order link');if(await row.locator('details p').first().textContent()!==i.blurb)throw Error('Scope drift');}console.log('PASS all '+catalog.items.length+' SKUs, prices, scopes and order links match shared catalog');
await page.screenshot({path:'/tmp/simple-pricing.png',fullPage:false});await page.goto(base+'/simple/');await page.screenshot({path:'/tmp/simple-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/simple-mobile.png',fullPage:true});
await page.unroute('**/catalog?practice=ai');await page.route('**/catalog?practice=ai',r=>r.abort());await page.goto(base+'/simple/pricing/');await page.getByText('We could not load current prices. Please use the main pricing page or contact us.').waitFor();console.log('PASS catalog failure fallback');if(errors.length)throw Error(errors.join('\n'));await browser.close();
})();
