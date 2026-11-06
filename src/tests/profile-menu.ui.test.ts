import assert from 'node:assert/strict';
import { after,before,test } from 'node:test';
import { chromium,expect,type Browser,type Page } from '@playwright/test';
import type { ViteDevServer } from 'vite';
import { startProfileMenuServer } from './fixtures/profile-menu-server.ts';

let server:ViteDevServer,browser:Browser,base:string;
before(async()=>{
  server=await startProfileMenuServer();const address=server.httpServer!.address();base=`http://127.0.0.1:${typeof address==='object' && address ? address.port : ''}`;
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-proxy-server']});
});
after(async()=>{await browser?.close();await server?.close();});
async function menuPage(state='',viewport={width:390,height:844}){
  const context=await browser.newContext({viewport,colorScheme:'dark'});context.setDefaultTimeout(15000);
  await context.route('**/*',route=>route.request().url().startsWith(base+'/') ? route.continue() : route.abort());
  await context.addInitScript(state=>{localStorage.setItem('theme','light');localStorage.setItem('menu-state',state);},state);
  const page=await context.newPage();page.on('pageerror',error=>process.stderr.write(`Profile menu fixture: ${error.message}\n`));
  await page.goto(base+'/profile-menu-fixture',{timeout:60000});return page;
}
const open=async(page:Page)=>{await page.getByTestId('header-user-menu').click();await expect(page.getByRole('menu',{name:'Profile menu'})).toBeVisible();};

test('profile menu preserves account actions, unread messages and the actual coin balance without a false dollar amount',async()=>{
  const page=await menuPage();try{
    await open(page);const menu=page.getByRole('menu',{name:'Profile menu'});
    for(const name of ['Search','View profile','Messages','Settings','Clear cache & refresh','Log out']) await expect(menu.getByRole('menuitem',{name:new RegExp('^'+name)})).toBeVisible();
    await expect(menu.getByText('Hana Tesfaye',{exact:true})).toBeVisible();await expect(menu.getByText('@hana.tesfaye',{exact:true})).toBeVisible();
    await expect(menu.getByRole('menuitem',{name:/Wallet.*1,250/})).toBeVisible();await expect(menu.getByLabel('7 unread messages',{exact:true})).toBeVisible();assert.equal((await menu.innerText()).includes('$'),false);
  }finally{await page.context().close();}
});

for(const [item,dialog] of [['Search','SearchModal'],['View profile','ProfileModal'],['Wallet','WalletModal'],['Settings','SettingsModal']]){
  test(`${item} opens the existing screen and dismisses the dropdown`,async()=>{
    const page=await menuPage();try{await open(page);await page.getByRole('menuitem',{name:new RegExp('^'+item)}).click();await expect(page.getByRole('menu')).toHaveCount(0);await expect(page.getByRole('dialog',{name:dialog,exact:true})).toBeVisible();}finally{await page.context().close();}
  });
}
test('the account summary still opens the user profile',async()=>{
  const page=await menuPage();try{await open(page);await page.getByRole('menuitem',{name:'Open profile for Hana Tesfaye',exact:true}).click();await expect(page.getByRole('dialog',{name:'ProfileModal',exact:true})).toBeVisible();}finally{await page.context().close();}
});
test('keyboard opening, typeahead, Escape, outside click and browser Back dismiss correctly',async()=>{
  const page=await menuPage();try{
    const trigger=page.getByTestId('header-user-menu');await trigger.focus();await page.keyboard.press('ArrowDown');await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('v');await expect(page.getByRole('menuitem',{name:/^View profile/})).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);await expect(trigger).toBeFocused();
    await open(page);await page.mouse.click(4,750);await expect(page.getByRole('menu')).toHaveCount(0);
    await open(page);await page.goBack();await expect(page.getByRole('menu')).toHaveCount(0);await expect(trigger).toHaveAttribute('aria-expanded','false');
  }finally{await page.context().close();}
});
test('appearance choices are checked radio items and persist without closing the menu',async()=>{
  const page=await menuPage();try{
    await open(page);await expect(page.getByRole('menuitemradio',{name:'Light',exact:true})).toHaveAttribute('aria-checked','true');
    await page.getByRole('menuitemradio',{name:'Dark',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.getByRole('menu')).toBeVisible();
    await page.getByRole('menuitemradio',{name:'System',exact:true}).click();await expect(page.getByRole('menuitemradio',{name:'System',exact:true})).toHaveAttribute('aria-checked','true');assert.equal(await page.evaluate(()=>localStorage.getItem('theme')),'system');
    await page.getByRole('menuitemradio',{name:'Light',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  }finally{await page.context().close();}
});
test('messages, refresh and logout retain their existing handlers',async()=>{
  const page=await menuPage();try{
    await open(page);await page.getByTestId('menu-messages').click();await expect(page.getByTestId('current-path')).toHaveText('/messages');
    await open(page);await page.getByRole('menuitem',{name:'Clear cache & refresh',exact:true}).click();assert.equal(await page.evaluate(()=>(window as any).profileMenuFixture.refreshes),1);
    await open(page);await page.getByTestId('menu-logout').click();await expect(page.getByTestId('current-path')).toHaveText('/login');assert.equal(await page.evaluate(()=>(window as any).profileMenuFixture.signOuts),1);
  }finally{await page.context().close();}
});
test('a narrow short viewport scrolls the menu without clipping long names or logout',async()=>{
  const page=await menuPage('long',{width:320,height:480});try{
    await open(page);const menu=page.getByRole('menu');
    assert.equal(await menu.evaluate(element=>{const rect=element.getBoundingClientRect();return rect.left>=0 && rect.right<=innerWidth && rect.top>=0 && rect.bottom<=innerHeight && element.scrollWidth<=element.clientWidth;}),true);
    const actions=await menu.locator('[role="menuitem"],[role="menuitemradio"]').evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().height));assert.ok(actions.every(height=>height>=44));
    await page.keyboard.press('End');await expect(page.getByTestId('menu-logout')).toBeFocused();await expect(page.getByTestId('menu-logout')).toBeInViewport();
  }finally{await page.context().close();}
});
test('loading and failed balance states never display a fabricated zero',async()=>{
  for(const state of ['loading','error']){const page=await menuPage(state);try{await open(page);if(state==='loading')await expect(page.getByRole('status',{name:'Loading coin balance',exact:true})).toBeVisible();else await expect(page.getByText('Balance unavailable',{exact:true})).toBeVisible();await expect(page.getByText('1,250',{exact:true})).toHaveCount(0);}finally{await page.context().close();}}
});
test('menu text and theme choices retain readable contrast in light and dark mode',async()=>{
  const page=await menuPage();try{
    await open(page);
    for(const theme of ['Light','Dark']){
      await page.getByRole('menuitemradio',{name:theme,exact:true}).click();
      const failed=await page.getByRole('menu').evaluate(menu=>{
        const color=(value:string)=>{const parts=value.match(/[\d.]+/g)?.map(Number) || [0,0,0];return [parts[0],parts[1],parts[2],parts[3] ?? 1];};
        const lum=(rgb:number[])=>rgb.slice(0,3).map(channel=>{const value=channel/255;return value<=.04045 ? value/12.92 : ((value+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
        const background=(element:Element|null):number[]=>{if(!element)return [255,255,255,1];const rgb=color(getComputedStyle(element).backgroundColor);return rgb[3]===1 ? rgb : background(element.parentElement);};
        return Array.from(menu.querySelectorAll('strong,small,.profile-dropdown-handle,.profile-dropdown-eyebrow,.profile-dropdown-appearance > div:first-child,[role="menuitemradio"],.profile-dropdown-item--compact,.profile-dropdown-unread')).flatMap(element=>{
          const a=lum(color(getComputedStyle(element).color)),b=lum(background(element)),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);return ratio<4.5 ? [{text:element.textContent,ratio}] : [];
        });
      });assert.deepEqual(failed,[]);
    }
  }finally{await page.context().close();}
});
