import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect, type Browser, type Page } from '@playwright/test';
import { createServer, transformWithEsbuild, type ViteDevServer } from 'vite';

let server: ViteDevServer, browser: Browser, base: string;
const fixtureSource=await readFile(new URL('./fixtures/circle-leave-client.ts',import.meta.url),'utf8');
before(async()=>{
  server=await createServer({configFile:false,cacheDir:'node_modules/.vite-circle-leave-ui',resolve:{alias:{'@':fileURLToPath(new URL('../',import.meta.url))}},
    optimizeDeps:{entries:['src/tests/fixtures/circle-leave-ui.tsx'],include:['react','react-dom/client','react-router-dom','@tanstack/react-query']},
    server:{host:'127.0.0.1',port:8993,hmr:false,watch:null},
    plugins:[{name:'isolated-leave-flow',enforce:'pre',
      resolveId(source){
        const path=source.replace(/\\/g,'/').replace(/\/+/g,'/');
        if(source==='virtual:leave-client' || /(?:@|\/src)\/integrations\/supabase\/client(?:\.ts)?$/.test(path)) return '\0leave-client.ts';
        if(/(?:@|\/src)\/contexts\/UserContext(?:\.tsx)?$/.test(path)) return '\0leave-user';
        if(/(?:@|\/src)\/hooks\/useCircleInvitations(?:\.ts)?$/.test(path)) return '\0leave-invitations';
        if(/(?:@\/components\/|\/src\/components\/|^\.\/)(?:circles\/)?(?:PublicProfileModal|FooterNav|CirclePosts|CircleServices|CircleEvents|CircleLearn|CircleMembers|CircleAbout|CircleMessages|CircleActivityStrip|CircleGettingStarted|EditCircleModal|CircleSettingsModal|FriendPicker|SubscribeCircleModal)(?:\.tsx)?$/.test(path)) return '\0leave-empty';
      },
      async load(id){
        const path=id.replace(/\\/g,'/').replace(/\/+/g,'/');
        if(path.endsWith('/src/contexts/UserContext.tsx')) return "import {fixture} from 'virtual:leave-client'; export const useUser=()=>({user:fixture.user});";
        if(path.endsWith('/src/integrations/supabase/client.ts')) return "export {supabase} from 'virtual:leave-client';";
        if(path.endsWith('/src/hooks/useCircleInvitations.ts')) return 'export const useSendCircleInvitation=()=>({sendInvitation:async()=>{}});';
        if(/\/src\/components\/(?:circles\/)?(?:PublicProfileModal|FooterNav|CirclePosts|CircleServices|CircleEvents|CircleLearn|CircleMembers|CircleAbout|CircleMessages|CircleActivityStrip|CircleGettingStarted|EditCircleModal|CircleSettingsModal|FriendPicker|SubscribeCircleModal)\.tsx$/.test(path)) return 'export default function Empty(){return null;} export const SubscribeCircleModal=()=>null;';
        if(id==='\0leave-client.ts') return (await transformWithEsbuild(fixtureSource,'circle-leave-client.ts',{loader:'ts',target:'es2020'})).code;
        if(id==='\0leave-user') return "import {fixture} from 'virtual:leave-client'; export const useUser=()=>({user:fixture.user});";
        if(id==='\0leave-invitations') return 'export const useSendCircleInvitation=()=>({sendInvitation:async()=>{}});';
        if(id==='\0leave-empty') return 'export default function Empty(){return null;} export const SubscribeCircleModal=()=>null;';
      },
      configureServer(instance){instance.middlewares.use((req,res,next)=>{
        if(req.url?.startsWith('/leave-fixture')){
          res.setHeader('Content-Type','text/html');
          res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/src/tests/fixtures/circle-leave-ui.tsx"></script></body></html>');
        }else next();
      });},
    }],
  });
  await server.listen();
  const address=server.httpServer!.address();
  base=`http://127.0.0.1:${typeof address==='object' && address ? address.port : ''}`;
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-proxy-server']});
});
after(async()=>{await browser?.close(); await server?.close();});
async function pageFor(query='') {
  const context=await browser.newContext();
  context.setDefaultTimeout(8000);
  await context.route('**/*',route=>route.request().url().startsWith(base+'/') ? route.continue() : route.abort());
  const page=await context.newPage();
  page.on('pageerror',error=>process.stderr.write(`Fixture browser: ${error.stack || error.message}\n`));
  await page.goto(`${base}/leave-fixture${query}`);
  return page;
}
async function confirmFor(page: Page,manager=false) {
  await page.getByRole('button',{name:manager ? 'Manage' : 'Joined',exact:true}).click();
  await page.getByRole('menuitem',{name:'Leave Circle',exact:true}).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
}

test('Stay leaves membership unchanged and a failed API keeps confirmation open without success navigation',async()=>{
  const page=await pageFor();
  try {
    await confirmFor(page);
    await expect(page.getByText(/does not cancel any paid subscription/)).toBeVisible();
    await page.getByRole('button',{name:'Stay',exact:true}).click();
    assert.equal(await page.evaluate(()=>(window as any).leaveFixture.calls),0);
    await confirmFor(page);
    await page.evaluate(()=>{(window as any).leaveFixture.fail=true;});
    await page.getByRole('button',{name:'Leave Circle',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('Network unavailable');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByRole('button',{name:'Leave Circle',exact:true})).toBeEnabled();
    assert.equal(await page.evaluate(()=>(window as any).leaveFixture.status),'active');
    await page.getByRole('button',{name:'Stay',exact:true}).click();
    await expect(page.getByRole('button',{name:'Joined',exact:true})).toBeVisible();
  } finally {await page.context().close();}
});

test('pending leave disables repeated clicks and only confirmed success updates lists/counts and navigates',async()=>{
  const page=await pageFor('?paid=1&private=1');
  try {
    await confirmFor(page);
    await page.evaluate(()=>{(window as any).leaveFixture.hold=true;});
    await page.getByRole('button',{name:'Leave Circle',exact:true}).click();
    await expect(page.getByRole('button',{name:'Leaving…',exact:true})).toBeDisabled();
    await expect(page.getByRole('button',{name:'Stay',exact:true})).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    assert.equal(await page.evaluate(()=>(window as any).leaveFixture.calls),1);
    await page.evaluate(()=>{(window as any).leaveFixture.release();});
    await expect(page.getByRole('heading',{name:'Your Circles'})).toBeVisible();
    await expect(page.getByText('Joined Circles: 0')).toBeVisible();
    await expect(page.getByText('Members: 1',{exact:true})).toBeVisible();
    await page.getByRole('link',{name:'View Circle'}).click();
    await expect(page.getByRole('button',{name:'Join',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Subscription',exact:true}).click();
    await expect(page.getByRole('menuitem',{name:'Cancel renewal',exact:true})).toBeVisible();
    await expect(page.getByRole('menuitem',{name:'Leave Circle',exact:true})).toHaveCount(0);
  } finally {await page.context().close();}
});

test('non-owner admins can leave from Manage while owners get explicit transfer/deletion options',async()=>{
  const admin=await pageFor('?role=admin');
  try {
    await confirmFor(admin,true);
    await admin.getByRole('button',{name:'Stay',exact:true}).click();
  } finally {await admin.context().close();}
  const owner=await pageFor('?role=owner');
  try {
    await owner.getByRole('button',{name:'Manage',exact:true}).click();
    await expect(owner.getByRole('menuitem',{name:'Leave Circle',exact:true})).toHaveCount(0);
    await owner.getByRole('menuitem',{name:'Transfer ownership or delete Circle',exact:true}).click();
    await expect(owner.getByText(/Transfer ownership and wait for the new owner to accept/)).toBeVisible();
    await owner.getByRole('button',{name:/Transfer Ownership/}).click();
    await expect(owner.getByText(/you will remain a member and can choose Leave Circle/)).toBeVisible();
    assert.equal(await owner.evaluate(()=>(window as any).leaveFixture.calls),0);
  } finally {await owner.context().close();}
});
