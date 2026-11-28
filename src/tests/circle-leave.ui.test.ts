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
        const setupSection = /(?:@\/components\/circles\/|\/src\/components\/circles\/|^\.\/)(CirclePosts|CircleMembers|CircleVideos|CircleResources|EditCircleModal)(?:\.tsx)?$/.exec(path)?.[1];
        if (setupSection) return `\0leave-setup-${setupSection}`;
        if(/(?:@\/components\/|\/src\/components\/|^\.\/)(?:circles\/)?(?:PublicProfileModal|FooterNav|CircleServices|CircleEvents|CircleAbout|CircleMessages|CircleActivityStrip|CircleSettingsModal|FriendPicker|SubscribeCircleModal)(?:\.tsx)?$/.test(path)) return '\0leave-empty';
      },
      async load(id){
        const path=id.replace(/\\/g,'/').replace(/\/+/g,'/');
        if(path.endsWith('/src/contexts/UserContext.tsx')) return "import {fixture} from 'virtual:leave-client'; export const useUser=()=>({user:fixture.user});";
        if(path.endsWith('/src/integrations/supabase/client.ts')) return "export {supabase} from 'virtual:leave-client';";
        if(path.endsWith('/src/hooks/useCircleInvitations.ts')) return 'export const useSendCircleInvitation=()=>({sendInvitation:async()=>{}});';
        if(/\/src\/components\/(?:circles\/)?(?:PublicProfileModal|FooterNav|CircleServices|CircleEvents|CircleAbout|CircleMessages|CircleActivityStrip|CircleSettingsModal|FriendPicker|SubscribeCircleModal)\.tsx$/.test(path)) return 'export default function Empty(){return null;} export const SubscribeCircleModal=()=>null;';
        if(id==='\0leave-client.ts') return (await transformWithEsbuild(fixtureSource,'circle-leave-client.ts',{loader:'ts',target:'es2020'})).code;
        if(id==='\0leave-user') return "import {fixture} from 'virtual:leave-client'; export const useUser=()=>({user:fixture.user});";
        if(id==='\0leave-invitations') return 'export const useSendCircleInvitation=()=>({sendInvitation:async()=>{}});';
        if (id === '\0leave-setup-EditCircleModal') return "import React from 'react'; export default ({open, onOpenChange}) => open ? React.createElement('button', {onClick: () => onOpenChange(false)}, 'Close cover editor') : null;";
        if (id.startsWith('\0leave-setup-')) return `export default () => '${id.slice('\0leave-setup-'.length)} section';`;
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

test('the setup checklist opens and scrolls to each destination, including completed steps', async () => {
  const page = await pageFor('?role=owner&setup=1');
  try {
    await page.setViewportSize({ width: 390, height: 600 });
    await page.addStyleTag({ content: '[aria-label="Circle sections"] { margin-top: 700px; min-height: 650px; }' });
    const sections = page.getByRole('region', { name: 'Circle sections' });
    await page.getByRole('button', { name: /Add a cover banner/ }).click({ timeout: 20000 });
    await page.getByRole('button', { name: 'Close cover editor' }).click();

    for (const [step, content] of [
      ['Write your first post', 'CirclePosts section'],
      ['Invite your first members', 'CircleMembers section'],
      ['Share your first resource', 'CircleResources section'],
      ['Upload your first video', 'CircleVideos section'],
      ['Share your first resource', 'CircleResources section'],
    ]) {
      await page.getByRole('button', { name: new RegExp(step) }).click();
      await expect(sections).toBeFocused();
      await expect(sections.getByText(content)).toBeInViewport();
    }
  } finally {
    await page.context().close();
  }
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
    await admin.getByRole('button',{name:'Manage',exact:true}).click();
    await expect(admin.getByRole('menuitem',{name:'Admin controls',exact:true})).toHaveCount(0);
    await admin.getByRole('menuitem',{name:'Leave Circle',exact:true}).click();
    await expect(admin.getByRole('alertdialog')).toBeVisible();
    await admin.getByRole('button',{name:'Stay',exact:true}).click();
  } finally {await admin.context().close();}
  const owner=await pageFor('?role=owner&adminControls=1');
  try {
    await owner.getByRole('button',{name:'Manage',exact:true}).click();
    await expect(owner.getByRole('menuitem',{name:'Leave Circle',exact:true})).toHaveCount(0);
    await owner.getByRole('menuitem',{name:'Admin controls',exact:true}).click();
    const controls = owner.getByRole('dialog', { name: 'Admin controls' });
    const invitePermission = controls.getByRole('switch', { name: 'Share member invite links' });
    await expect(invitePermission).toBeChecked();
    await invitePermission.click();
    await expect(invitePermission).not.toBeChecked();
    await controls.getByRole('button', { name: 'Remove admin access' }).click();
    const confirmRemoval = owner.getByRole('alertdialog', { name: 'Remove admin access?' });
    await confirmRemoval.getByRole('button', { name: 'Remove admin access' }).click();
    await expect(controls.getByText('Test Admin', { exact: true })).toHaveCount(0);
    await controls.getByRole('button', { name: 'Add Admin', exact: true }).click();
    const adminDialog = owner.getByRole('dialog',{name:'Add Admin',exact:true});
    await expect(adminDialog).toBeVisible();
    await expect(adminDialog.getByRole('button',{name:'Send Invite',exact:true})).toBeDisabled();
    await adminDialog.getByRole('button',{name:'Back',exact:true}).click();
    await expect(adminDialog).toHaveCount(0);
    await controls.getByRole('button', { name: 'Close', exact: true }).click();

    await owner.getByRole('button',{name:'Manage',exact:true}).click();
    await owner.getByRole('menuitem',{name:'Transfer ownership or delete Circle',exact:true}).click();
    await expect(owner.getByText(/Transfer ownership and wait for the new owner to accept/)).toBeVisible();
    await owner.getByRole('button',{name:/Transfer Ownership/}).click();
    await expect(owner.getByText(/you will remain a member and can choose Leave Circle/)).toBeVisible();
    assert.equal(await owner.evaluate(()=>(window as any).leaveFixture.calls),0);
  } finally {await owner.context().close();}
});
