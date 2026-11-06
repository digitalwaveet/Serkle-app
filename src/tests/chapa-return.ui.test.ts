import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { startWalletFixtureServer } from './fixtures/wallet-server.ts';

import { chromium, expect, type Browser, type Page } from '@playwright/test';
import type { ViteDevServer } from 'vite';

let server: ViteDevServer, browser: Browser, base: string;
before(async () => {
  server = await startWalletFixtureServer();
  const address = server.httpServer!.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : ''}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-proxy-server'] });
});
after(async () => { await browser?.close(); await server?.close(); });

async function pageFor(scenario: string, pending = false, search = '', route = 'verify') {
  const context = await browser.newContext();
  context.setDefaultTimeout(15000);
  await context.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  await context.addInitScript(({ scenario, pending }) => {
    if (localStorage.getItem('chapa-return-fixture')) return;
    localStorage.setItem('chapa-return-fixture', scenario);
    if (pending) localStorage.setItem('chapa:pending:00000000-0000-0000-0000-000000000001', 'serkle-return-fixture');
  }, { scenario, pending });
  const page = await context.newPage();
  page.on('pageerror', error => process.stderr.write(`Return fixture: ${error.message}\n`));
  await page.goto(`${base}/${route}${search}`, { timeout: 60000 });
  return page;
}
const calls = (page: Page) => page.evaluate(() => (window as any).chapaReturnFixture.calls);

test('successful test verification clears pending storage without losing the receipt or showing a failure toast', async () => {
  const page = await pageFor('test', true);
  try {
    await expect(page.getByRole('heading', { name: 'Test payment successful' })).toBeVisible();
    await expect(page.getByText('Test mode does not add spendable coins', { exact: false })).toBeVisible();
    await expect(page.getByText('No payment credit available')).toHaveCount(0);
    assert.equal(await page.evaluate(() => localStorage.getItem('chapa:pending:00000000-0000-0000-0000-000000000001')), null);
    assert.equal(new URL(page.url()).searchParams.get('tx_ref'), 'serkle-return-fixture');
    assert.equal((await calls(page)).length, 1, 'persisting the URL must not repeat verification');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Test payment successful' })).toBeVisible();
    await expect(page.getByText('Transaction reference is missing', { exact: false })).toHaveCount(0);
  } finally { await page.context().close(); }
});

test('a legacy bare return URL recovers its reference server-side with no local storage', async () => {
  const page = await pageFor('test');
  try {
    await expect(page.getByRole('heading', { name: 'Test payment successful' })).toBeVisible();
    assert.deepEqual(await calls(page), [{}]);
    assert.equal(new URL(page.url()).searchParams.get('tx_ref'), 'serkle-return-fixture');
  } finally { await page.context().close(); }
});

test('multiple recent receipts require a choice before displaying a verified payment', async () => {
  const page = await pageFor('selection');
  try {
    await expect(page.getByRole('heading', { name: 'Choose the payment to check' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payment Successful!' })).toHaveCount(0);
    await page.getByRole('button', { name: /Check 20 ETB payment/ }).click();
    await expect(page.getByRole('heading', { name: 'Payment Successful!' })).toBeVisible();
    assert.deepEqual(await calls(page), [{}, { txRef: 'serkle-second' }]);
  } finally { await page.context().close(); }
});

test('unknown returns show verification guidance without claiming failure or credit', async () => {
  const page = await pageFor('unknown');
  try {
    await expect(page.getByRole('heading', { name: 'Payment needs verification' })).toBeVisible();
    await expect(page.getByText('No payment credit available')).toHaveCount(0);
    await page.getByRole('button', { name: 'Check payment status' }).click();
    await expect(page.getByRole('heading', { name: 'Payment needs verification' })).toBeVisible();
    assert.equal((await calls(page)).length, 2);
  } finally { await page.context().close(); }
});

test('pending receipts can be rechecked, and unverified success never becomes wallet credit', async () => {
  const page = await pageFor('pending', false, '?trx_ref=serkle-return-fixture');
  try {
    await expect(page.getByRole('heading', { name: 'Payment pending' })).toBeVisible();
    await page.getByRole('button', { name: 'Check payment status' }).click();
    await expect(page.getByRole('heading', { name: 'Payment Successful!' })).toBeVisible();
    assert.equal((await calls(page)).length, 2);
  } finally { await page.context().close(); }
  const forged = await pageFor('forged', false, '?tx_ref=serkle-return-fixture');
  try {
    await expect(forged.getByRole('heading', { name: 'Payment pending' })).toBeVisible();
    await expect(forged.getByRole('heading', { name: 'Payment Successful!' })).toHaveCount(0);
  } finally { await forged.context().close(); }
});

test('login preserves the payment reference for verification after authentication', async () => {
  const page = await pageFor('login', false, '?tx_ref=serkle-return-fixture');
  try {
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    assert.equal(new URL(page.url()).searchParams.get('returnTo'), '/verify?tx_ref=serkle-return-fixture');
    assert.equal((await calls(page)).length, 0);
  } finally { await page.context().close(); }
});

test('wallet history lists test and failed attempts, filters modes and paginates receipt timelines', async()=>{
  const page=await pageFor('history',false,'','wallet-fixture');
  try {
    await expect(page.getByRole('button',{name:/history-payment-0(?:\D|$)/})).toBeVisible();
    await expect(page.getByText('Failed at last check',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Load more payments',exact:true}).click();
    await expect(page.getByRole('button',{name:/history-payment-25(?:\D|$)/})).toBeVisible();
    await page.getByLabel('Payment mode').selectOption('test');
    await expect(page.getByRole('button',{name:/history-payment-1(?:\D|$)/})).toHaveCount(0);
    await page.getByRole('button',{name:/history-payment-0(?:\D|$)/}).click();
    const dialog=page.getByRole('dialog',{name:'Payment receipt',exact:true});
    await expect(dialog.getByText('Test successful',{exact:true})).toBeVisible();
    await expect(dialog.getByText('No spendable coin movement has been recorded for this payment.')).toBeVisible();
    await expect(dialog.getByText('fixture-provider-receipt',{exact:true})).toBeVisible();
    await dialog.locator('summary').filter({hasText:'Status history'}).click();
    await dialog.getByRole('button',{name:'Load earlier status updates'}).click();
    await expect(dialog.getByRole('button',{name:'Load earlier status updates'})).toHaveCount(0);
  } finally {await page.context().close();}
});

test('checking a saved receipt updates its status without starting another checkout', async()=>{
  const page=await pageFor('history',false,'','wallet-fixture');
  try {
    await page.getByRole('button',{name:/history-payment-1(?:\D|$)/}).click();
    const dialog=page.getByRole('dialog',{name:'Payment receipt',exact:true});await expect(dialog.getByText('Awaiting confirmation',{exact:true})).toBeVisible();
    await dialog.getByRole('button',{name:'Check payment status'}).click();
    await expect(dialog.getByText('Completed',{exact:true})).toBeVisible();
    assert.deepEqual(await calls(page),[{txRef:'history-payment-1'}]);
    assert.equal(await page.evaluate(()=>(window as any).chapaReturnFixture.payouts.length),0);
  } finally {await page.context().close();}
});

test('coin activity can load beyond 50 records and opens exact ledger details', async()=>{
  const page=await pageFor('history',false,'','wallet-fixture');
  try {
    await page.getByRole('tab',{name:'Coin activity',exact:true}).click();
    await expect(page.getByText('Your balance matches the recorded wallet movements.')).toBeVisible();
    for(let i=0;i<3;i++) await page.getByRole('button',{name:'Load more coin activity',exact:true}).click();
    await expect(page.getByText('Recorded movement 61',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Load more coin activity',exact:true})).toHaveCount(0);
    await page.getByText('View movement details',{exact:true}).first().click();
    await expect(page.getByText('ledger-000',{exact:true})).toBeVisible();
  } finally {await page.context().close();}
});

test('account-mismatched history responses are rejected before receipts can be displayed', async()=>{
  const page=await pageFor('history-wrong-account',false,'','wallet-fixture');
  try {
    await expect(page.getByRole('alert').filter({hasText:'Payment history could not be refreshed'})).toBeVisible();
    await expect(page.getByRole('button',{name:/history-payment-/})).toHaveCount(0);
  } finally {await page.context().close();}
});

test('withdrawal confirmation states test mode clearly and a mode change cannot submit a live payout', async()=>{
  const page=await pageFor('mode-change',false,'','wallet-fixture');
  try {
    await page.getByRole('tab',{name:'Withdraw',exact:true}).click();
    await expect(page.getByText('Test mode: withdrawals are recorded for testing.',{exact:false})).toBeVisible();
    await page.getByPlaceholder('Min. 10 ETB').fill('500');
    await page.getByPlaceholder('Full name as registered at bank').fill('Fixture Buyer');
    await page.getByPlaceholder('Account number').fill('1234567890');
    await page.getByRole('button',{name:/Select bank/}).click();
    await page.getByText('Fixture Bank',{exact:true}).click();
    await page.getByRole('button',{name:'Request Withdrawal',exact:true}).click();
    await expect(page.getByRole('alertdialog')).toContainText('Confirm Test Withdrawal');
    await page.getByRole('button',{name:'Confirm Withdrawal',exact:true}).click();
    await expect(page.getByText('Payment mode changed. Refresh the wallet and review the withdrawal before confirming.',{exact:true})).toBeVisible();
    assert.equal(await page.evaluate(()=>(window as any).chapaReturnFixture.payouts.length),0);
  } finally {await page.context().close();}
});

test('an uncertain checkout shows its saved-receipt guidance and subsequent clicks reuse the same request ID',async()=>{
  const page=await pageFor('topup-unconfirmed',false,'','wallet-fixture');
  try {
    await page.getByRole('tab',{name:'Top Up',exact:true}).click();
    await page.getByPlaceholder('Enter ETB amount (min. 10)').fill('50');
    await page.getByRole('button',{name:'Continue to Review',exact:true}).click();
    const pay=page.getByRole('button',{name:'Pay 50 ETB with Chapa',exact:true});
    for(let attempt=0;attempt<2;attempt++) {
      await pay.click();
      await expect(page.getByRole('alert').filter({hasText:'Your payment reference is recorded; check its status before trying another payment.'})).toBeVisible();
    }
    const attempts=await page.evaluate(()=>(window as any).chapaReturnFixture.checkouts);
    assert.equal(attempts.length,2);assert.equal(attempts[0].requestId,attempts[1].requestId);
    assert.equal(await page.evaluate(()=>localStorage.getItem('chapa:pending:00000000-0000-0000-0000-000000000001')),'saved-checkout-fixture');
    assert.ok(page.url().includes('/wallet-fixture'),'an unconfirmed checkout must not navigate to an invented URL');
  } finally {await page.context().close();}
});

test('wallet and receipt remain usable at 320px with long references and balances in light and dark themes',async()=>{
  const page=await pageFor('history-large',false,'','wallet-fixture');
  try {
    await page.setViewportSize({width:320,height:800});
    for(const theme of ['light','dark']) {
      await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
      assert.equal(await page.locator('.wallet-screen').evaluate(element=>element.scrollWidth<=element.clientWidth),true);
      for(const name of ['History','Top Up','Withdraw']) {
        const bounds=await page.getByRole('tab',{name,exact:true}).boundingBox();assert.ok(bounds && bounds.height>=44 && bounds.width>=44);
      }
      await page.locator('.wallet-payment-row').first().click();
      const receipt=page.getByRole('dialog',{name:'Payment receipt',exact:true});
      await expect(receipt.getByText('serkle-00000000-0000-0000-0000-000000000001',{exact:true})).toBeVisible();
      assert.equal(await receipt.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
      const contained=await receipt.evaluate(element=>{const bounds=element.getBoundingClientRect();return bounds.left>=0 && bounds.right<=innerWidth;});assert.equal(contained,true);
      await receipt.getByRole('button',{name:'Close receipt'}).click();
    }
  } finally {await page.context().close();}
});

test('receipt traps keyboard focus above the wallet and Escape restores the exact opener',async()=>{
  const page=await pageFor('history',false,'','wallet-fixture');
  try {
    const opener=page.getByRole('button',{name:/history-payment-0(?:\D|$)/});await opener.click();
    const receipt=page.getByRole('dialog',{name:'Payment receipt',exact:true});
    await expect(receipt.getByRole('button',{name:'Close receipt'})).toBeFocused();
    assert.equal(await receipt.evaluate(element=>{const bounds=element.getBoundingClientRect();return element.contains(document.elementFromPoint(bounds.x+bounds.width/2,bounds.y+bounds.height/2));}),true);
    for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert.equal(await receipt.evaluate(element=>element.contains(document.activeElement)),true);}
    await page.keyboard.press('Escape');await expect(receipt).toHaveCount(0);await expect(opener).toBeFocused();
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Wallet',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Open wallet'})).toBeVisible();
  } finally {await page.context().close();}
});

test('top-up and withdrawal inputs have labels, clear invalid-amount guidance and keyboard access',async()=>{
  const page=await pageFor('history',false,'','wallet-fixture');
  try {
    await page.getByRole('tab',{name:'Top Up',exact:true}).click();
    const amount=page.getByRole('textbox',{name:'Or enter a custom amount',exact:true});
    await amount.fill('10.5');await expect(amount).toHaveAttribute('aria-invalid','true');
    await expect(page.getByText('Enter a whole amount from 10 to 1,000,000 ETB.',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Continue to Review',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:/^500\s*ETB$/}).click();await expect(page.getByRole('button',{name:/^500\s*ETB$/})).toHaveAttribute('aria-pressed','true');
    await page.getByRole('tab',{name:'Withdraw',exact:true}).click();
    for(const name of ['Amount (ETB)','Account holder name','Account / wallet number']) await expect(page.getByRole('textbox',{name,exact:true})).toBeVisible();
    await page.getByRole('textbox',{name:'Account / wallet number',exact:true}).fill('abc');
    await expect(page.getByText('Enter 6–30 digits, without spaces or symbols.',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Request Withdrawal',exact:true})).toBeDisabled();
  } finally {await page.context().close();}
});

test('receipt copy and printable document contain saved test data without initiating a payment',async()=>{
  const page=await pageFor('history',false,'','wallet-fixture');
  try {
    await page.evaluate(()=>{
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).copiedReceipt=text;}}});
      window.print=()=>{(window as any).printRequested=true;};
    });
    await page.getByRole('button',{name:/history-payment-0(?:\D|$)/}).click();
    const receipt=page.getByRole('dialog',{name:'Payment receipt',exact:true});
    await receipt.getByRole('button',{name:'Copy receipt details',exact:true}).click();await expect(receipt.getByRole('button',{name:'Copied',exact:true})).toBeVisible();
    const text=await page.evaluate(()=>(window as any).copiedReceipt);assert.ok(text.includes('fixture-provider-receipt'));assert.ok(text.includes('TEST ONLY'));assert.ok(text.includes('Recorded coin movement: 0'));
    await receipt.getByRole('button',{name:'Print / Save PDF',exact:true}).click();assert.equal(await page.evaluate(()=>(window as any).printRequested),true);
    await page.emulateMedia({media:'print'});await expect(page.locator('.wallet-receipt-paper')).toBeVisible();await expect(page.locator('.wallet-receipt-controls')).toBeHidden();await expect(page.locator('.wallet-header')).toBeHidden();
    await mkdir('test-results/wallet-redesign',{recursive:true});
    const pdf=await page.pdf({path:'test-results/wallet-redesign/test-receipt.pdf',format:'A4',printBackground:true});assert.ok(pdf.byteLength>5000);
    await page.screenshot({path:'test-results/wallet-redesign/receipt-print-preview.png'});
    assert.deepEqual(await calls(page),[]);assert.equal(await page.evaluate(()=>(window as any).chapaReturnFixture.checkouts.length),0);
  } finally {await page.context().close();}
});

test('wallet preserves the Serkle loading animation and respects reduced motion',async()=>{
  const page=await pageFor('wallet-loading',false,'','wallet-fixture');
  try {
    const loader=page.getByRole('status',{name:'Loading balance',exact:true});await expect(loader).toBeVisible();
    await expect(loader.locator('.serkle-loader__word')).toHaveText('SERKLE');
    assert.equal(await loader.locator('.serkle-loader__letter').first().evaluate(element=>getComputedStyle(element).animationName),'serkle-letter-wave');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await loader.locator('.serkle-loader__letter').first().evaluate(element=>getComputedStyle(element).animationName),'none');
  } finally {await page.context().close();}
});

test('unknown balance and empty history use explicit states instead of fabricated zero balances or receipts',async()=>{
  const error=await pageFor('wallet-error',false,'','wallet-fixture');
  try {await expect(error.getByText('Balance could not be refreshed',{exact:true})).toBeVisible();await expect(error.locator('.wallet-balance-card')).toContainText('Unavailable');await expect(error.getByRole('button',{name:'Retry balance',exact:true})).toBeVisible();}
  finally {await error.context().close();}
  const empty=await pageFor('history-empty',false,'','wallet-fixture');
  try {await expect(empty.getByRole('heading',{name:'No payment receipts yet',exact:true})).toBeVisible();await empty.getByRole('tab',{name:'Coin activity',exact:true}).click();await expect(empty.getByRole('heading',{name:'No coin movements yet',exact:true})).toBeVisible();}
  finally {await empty.context().close();}
});

test('an unavailable bank list has a visible retry and cannot submit a withdrawal',async()=>{
  const page=await pageFor('banks-error',false,'','wallet-fixture');
  try {
    await page.getByRole('tab',{name:'Withdraw',exact:true}).click();await expect(page.getByText('Bank list could not be loaded',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Request Withdrawal',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Retry bank list',exact:true}).click();
    await expect(page.getByRole('button',{name:'Select bank or mobile wallet',exact:true})).toBeEnabled();assert.equal(await page.evaluate(()=>(window as any).chapaReturnFixture.payouts.length),0);
  } finally {await page.context().close();}
});

test('wallet labels, status text, form guidance and receipt details have readable text contrast in both themes',async()=>{
  const page=await pageFor('history',false,'','wallet-fixture');
  const assertContrast=async()=>{
    const failures=await page.evaluate(()=>{
      const rgb=(value:string)=>{const parts=value.match(/[\d.]+/g)?.map(Number) || [0,0,0];return [parts[0],parts[1],parts[2],parts[3] ?? 1];};
      const luminance=(color:number[])=>color.slice(0,3).map(channel=>{const value=channel/255;return value<=.04045 ? value/12.92 : ((value+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
      const backgrounds=(element:Element|null):number[][]=>{
        if(!element)return [[255,255,255,1]];
        const style=getComputedStyle(element),solid=rgb(style.backgroundColor);
        const gradient=style.backgroundImage.match(/rgba?\([^)]+\)/g);
        if(gradient)return gradient.map(rgb);
        if(solid[3]===1)return [solid];
        return backgrounds(element.parentElement).map(parent=>solid.slice(0,3).map((channel,index)=>channel*solid[3]+parent[index]*(1-solid[3])).concat(1));
      };
      const selectors='[role="tab"],.wallet-section-heading p,.wallet-filter-bar p,.wallet-row-date,.wallet-row-reference,.wallet-mode,.wallet-status,.wallet-balance-label h2,.wallet-balance-equivalent,.wallet-balance-stats dt,.wallet-field label,.wallet-field-help,.wallet-button--primary:not(:disabled),.wallet-receipt-details dt,.wallet-receipt-details dd,.wallet-receipt-footer';
      return Array.from(document.querySelectorAll(selectors)).filter(element=>element.getBoundingClientRect().height && !element.closest('[aria-hidden="true"]')).flatMap(element=>{
        const fg=luminance(rgb(getComputedStyle(element).color));
        const ratio=Math.min(...backgrounds(element).map(background=>{const bg=luminance(background);return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);}));
        return ratio<4.5 ? [{text:element.textContent?.slice(0,65),ratio}] : [];
      });
    });
    assert.deepEqual(failures,[]);
  };
  try {
    for(const theme of ['light','dark']) {
      await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);await assertContrast();
      await page.getByRole('button',{name:/history-payment-0(?:\D|$)/}).click();await assertContrast();
      await page.getByRole('button',{name:'Close receipt',exact:true}).click();
      await page.getByRole('tab',{name:'Top Up',exact:true}).click();await page.getByRole('textbox',{name:'Or enter a custom amount',exact:true}).fill('50');await assertContrast();
      await page.getByRole('tab',{name:'History',exact:true}).click();
    }
  } finally {await page.context().close();}
});
