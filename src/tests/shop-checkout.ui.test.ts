import assert from 'node:assert/strict';
import { after,before,test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium,expect,type Browser,type Page } from '@playwright/test';
import { createServer,transformWithEsbuild,type ViteDevServer } from 'vite';
import { SHOP_COIN_PAYMENTS_UNAVAILABLE } from '../lib/shopPayments.ts';

let server:ViteDevServer,browser:Browser,base:string;
const fixtureSource=await readFile(new URL('./fixtures/shop-checkout-client.ts',import.meta.url),'utf8');
before(async()=>{
  server=await createServer({configFile:false,cacheDir:'node_modules/.vite-shop-pause-ui',
    resolve:{alias:{'@':fileURLToPath(new URL('../',import.meta.url))}},
    optimizeDeps:{entries:['src/tests/fixtures/shop-checkout-ui.tsx'],include:['react','react-dom/client','@tanstack/react-query','@radix-ui/react-dialog','@radix-ui/react-radio-group']},
    server:{host:'127.0.0.1',port:8997,strictPort:true,hmr:false,watch:null},
    plugins:[{name:'isolated-shop-checkout',enforce:'pre',
      resolveId(source){
        const path=source.replace(/\\/g,'/');
        if(source==='virtual:shop-checkout-client' || /(?:^|\/)integrations\/supabase\/client(?:\.ts)?$/.test(path)) return '\0shop-checkout-client';
        if(/(?:^|\/)contexts\/CartContext(?:\.tsx)?$/.test(path)) return '\0shop-checkout-cart';
      },
      async load(id){
        if(id==='\0shop-checkout-client') return (await transformWithEsbuild(fixtureSource,'shop-checkout-client.ts',{loader:'ts',target:'es2020'})).code;
        if(id==='\0shop-checkout-cart') return "import {cart} from 'virtual:shop-checkout-client';export const useCart=()=>cart;";
      },
      configureServer(instance){instance.middlewares.use((req,res,next)=>{
        if(req.url==='/shop-fixture') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/src/tests/fixtures/shop-checkout-ui.tsx"></script></body></html>');}
        else next();
      });},
    }],
  });
  await server.listen();const address=server.httpServer!.address();
  base=`http://127.0.0.1:${typeof address==='object' && address ? address.port : ''}`;
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-proxy-server']});
});
after(async()=>{await browser?.close();await server?.close();});
async function checkout(){
  const context=await browser.newContext();context.setDefaultTimeout(15000);
  await context.route('**/*',route=>route.request().url().startsWith(base+'/') ? route.continue() : route.abort());
  const page=await context.newPage();page.on('pageerror',error=>process.stderr.write(`Shop fixture: ${error.message}\n`));
  await page.goto(base+'/shop-fixture',{timeout:60000});
  await page.getByLabel('Full Name *',{exact:true}).fill('Fixture Buyer');
  await page.getByLabel('Street Address *',{exact:true}).fill('123 Fixture Street');
  await page.getByLabel('City *',{exact:true}).fill('Addis Ababa');
  await page.getByLabel('ZIP Code *',{exact:true}).fill('1000');
  await page.getByRole('button',{name:'Continue to Payment',exact:true}).click();
  return page;
}
const activity=(page:Page)=>page.evaluate(()=>(window as any).shopCheckoutFixture);

test('Shop coins are visibly disabled while every existing alternative stays selectable',async()=>{
  const page=await checkout();try {
    await expect(page.getByRole('radio',{name:'Pay with Coins',exact:true})).toBeDisabled();
    await expect(page.getByText(SHOP_COIN_PAYMENTS_UNAVAILABLE,{exact:true})).toBeVisible();
    for(const name of ['Credit/Debit Card','PayPal','Apple Pay','Google Pay']) await expect(page.getByRole('radio',{name,exact:true})).toBeEnabled();
    assert.equal((await activity(page)).calls.length,0,'merely opening checkout cannot access or debit the wallet');
  } finally {await page.context().close();}
});
for(const [type,label] of [['card','Credit/Debit Card'],['paypal','PayPal'],['apple_pay','Apple Pay'],['google_pay','Google Pay']]) {
  test(`${label} preserves the existing order flow without a wallet debit`,async()=>{
    const page=await checkout();try {
      await page.getByRole('radio',{name:label,exact:true}).check();
      if(type==='card') {
        await page.getByLabel('Card Number',{exact:true}).fill('4111111111111111');
        await page.getByLabel('Expiry Date',{exact:true}).fill('12/30');
        await page.getByLabel('Cardholder Name',{exact:true}).fill('Fixture Buyer');
      }
      await page.getByRole('button',{name:'Review Order',exact:true}).click();
      await expect(page.getByRole('heading',{name:'Review Order',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Place Order',exact:true}).click();
      await expect.poll(async()=>(await activity(page)).closed).toBe(1);
      const result=await activity(page);
      assert.deepEqual(result.localPayments,[type]);
      assert.equal(result.calls.filter(call=>call.operation==='insert:orders').length,1);
      assert.equal(result.calls.filter(call=>call.operation==='insert:order_items').length,1);
      assert.deepEqual(result.calls.filter(call=>!call.operation.startsWith('insert:')).map(call=>call.operation),['auth','generate_order_number','update_item_stock']);
    } finally {await page.context().close();}
  });
}
test('a forged or stale coin selection is rejected by the real mutation before any API request',async()=>{
  const page=await checkout();try {
    for(const type of ['coins','COINS','unknown',null]) assert.equal(await page.evaluate(type=>(window as any).tryUnsupportedShopPayment(type),type),SHOP_COIN_PAYMENTS_UNAVAILABLE);
    const result=await activity(page);assert.equal(result.calls.length,0);assert.equal(result.closed,0);assert.deepEqual(result.localPayments,[]);
  } finally {await page.context().close();}
});
