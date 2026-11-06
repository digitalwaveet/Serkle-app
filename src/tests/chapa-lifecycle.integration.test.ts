import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID,createHmac,createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { after,before,beforeEach,test } from 'node:test';
import { createChapaHandlers,normalizeVerification,verifyWebhookSignature,providerDetails,PaymentError,type ChapaStore,type ChapaIntent } from '../../supabase/functions/_shared/chapa.ts';
import { createChapaTransferHandler } from '../../supabase/functions/_shared/chapaTransfer.ts';
import { CHAPA_RETURN_URL,topUpState,pendingChapaKey,chapaRequestKey,recordTopUpResult,writeChapaStorage,readChapaStorage } from '../lib/chapaPayments.ts';
import { authReturnPath,circleLoginPath } from '../lib/authReturnPath.ts';

const db=new PGlite();
const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const buyer=id(1),seller=id(2),other=id(3),circle=id(10),post=id(20),video=id(30),resource=id(40);
const secret='isolated-webhook-secret',scheduler='isolated-scheduler-secret';
const file=(path:string)=>readFile(new URL(path,import.meta.url),'utf8');
const q=async(sql:string,params:unknown[]=[]) => (await db.query<any>(sql,params)).rows;
async function login(user:string|null=buyer) {
  await db.exec('RESET ROLE');await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[user || '']);await db.exec(`SET ROLE ${user ? 'authenticated' : 'anon'}`);
}
async function service() {await db.exec('RESET ROLE; SET ROLE service_role');}
const data=new Map<string,any>();
let verifyCalls=0,initializeCalls=0,unavailable=false,initializedReturnUrl:unknown,payoutCalls=0,payoutUncertain=false,checkoutUncertain=false;
const store:ChapaStore={
  begin:async(user,request,amount,mode)=>{await service();return(await q('SELECT begin_chapa_payment($1,$2,$3,$4) result',[user,request,amount,mode]))[0].result;},
  get:async ref=>{await service();return(await q('SELECT * FROM chapa_payment_intents WHERE tx_ref=$1',[ref]))[0] || null;},
  beginWithdrawal:async(user,key,amount,mode,fingerprint,destinationHash,bank,hint)=>{await service();return(await q('SELECT begin_wallet_withdrawal($1,$2,$3,$4,$5,$6,$7,$8) result',[user,key,amount,mode,fingerprint,destinationHash,bank,hint]))[0].result;},
  claimWithdrawalSubmit:async ref=>{await service();return(await q('SELECT claim_wallet_withdrawal_submit($1) result',[ref]))[0].result;},
  withdrawalSubmitted:async ref=>{await service();await q('SELECT record_wallet_withdrawal_submission($1)',[ref]);},
  recoverUnsentWithdrawal:async(ref,source)=>{await service();return(await q('SELECT recover_unsent_withdrawal($1,$2) result',[ref,source]))[0].result;},
  claimCheckout:async ref=>{await service();return(await q('SELECT claim_chapa_checkout($1) result',[ref]))[0].result;},
  setCheckout:async(ref,url)=>{await service();await q('SELECT save_chapa_checkout($1,$2)',[ref,url]);},
  claimCheck:async(ref,source)=>{await service();return(await q('SELECT claim_chapa_check($1,$2) result',[ref,source]))[0].result;},
  apply:async(evidence,details,source)=>{await service();return(await q('SELECT record_chapa_check($1,$2,$3) result',[JSON.stringify(evidence),JSON.stringify(details),source]))[0].result;},
  due:async user=>{await service();return q("SELECT * FROM chapa_payment_intents WHERE ($1::uuid IS NULL OR user_id=$1) AND reversed_at IS NULL ORDER BY created_at LIMIT 25",[user || null]);},
  recent:async(user,since)=>{await service();return q('SELECT * FROM chapa_payment_intents WHERE user_id=$1 AND created_at>=$2 ORDER BY created_at DESC LIMIT 10',[user,since]);},
  error:async(ref,message,context)=>{await service();await q('SELECT record_chapa_error($1,$2,$3,$4,$5,$6)',[ref,context.stage,context.code,message,context.source,context.providerStatus || null]);},
  beginRun:async mode=>{await service();return(await q('INSERT INTO wallet_reconciliation_runs(mode) VALUES($1) RETURNING id',[mode]))[0].id;},
  finishRun:async(run,checked,errors)=>{await service();await q('UPDATE wallet_reconciliation_runs SET completed_at=now(),checked=$2,errors=$3 WHERE id=$1',[run,checked,errors]);},
  delivery:async(hash,ref,mode)=>{await service();await q('INSERT INTO chapa_webhook_deliveries(body_hash,tx_ref,mode) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[hash,ref,mode]);return!!(await q('SELECT processed_at FROM chapa_webhook_deliveries WHERE body_hash=$1',[hash]))[0].processed_at;},
  finishDelivery:async hash=>{await service();await q('UPDATE chapa_webhook_deliveries SET processed_at=now() WHERE body_hash=$1',[hash]);},
  reconcileGrants:async user=>{await service();await q('SELECT reconcile_circle_receipts($1)',[user]);},
};
function dependencies(mode:'live'|'test'='live',availableModes?:Array<'live'|'test'>) {
  return {store,mode,availableModes,origins:['https://serkle-app-five.vercel.app'],webhookSecret:secret,reconcileSecret:scheduler,
    authenticate:async request=>{
      const user=request.headers.get('authorization')?.replace('Bearer ','');
      if(![buyer,seller,other].includes(user || '')) throw new PaymentError('Authentication required',401);
      return{id:user!,email:'buyer@example.test'};
    },
    initialize:async payload=>{
      initializeCalls++;
      initializedReturnUrl=payload.return_url;
      data.set(payload.tx_ref as string,{status:'success',data:{tx_ref:payload.tx_ref,amount:payload.amount,currency:'ETB',mode,status:'pending',reference:`provider-${payload.tx_ref}`,updated_at:new Date().toISOString()}});
      if(checkoutUncertain) throw new Error('Checkout response was lost');
      return `https://checkout.chapa.co/checkout/${payload.tx_ref}`;
    },
    banks:async()=>[{id:855,name:'Fixture Bank',acct_length:10}],
    initializeWithdrawal:async(payload:Record<string,unknown>)=>{
      payoutCalls++;
      data.set(payload.reference as string,{status:'success',data:{reference:payload.reference,chapa_reference:`payout-${payload.reference}`,amount:payload.amount,currency:'ETB',mode,
        status:'pending',bank_id:payload.bank_code,account_number:payload.account_number,updated_at:new Date().toISOString()}});
      if(payoutUncertain) throw new Error('Provider accepted but response timed out');
      return {status:'success'};
    },
    verify:async intent=>{verifyCalls++;if(unavailable)throw new Error('Provider unavailable');return data.get(intent.tx_ref);},
  };
}
const handlers=(mode:'live'|'test'='live',availableModes?:Array<'live'|'test'>)=>createChapaHandlers(dependencies(mode,availableModes));
const transfers=(mode:'live'|'test'='live')=>createChapaTransferHandler(dependencies(mode));
const request=(body:unknown,user:string|null=buyer,extra:Record<string,string>={})=>new Request('https://edge.test',{method:'POST',headers:{'content-type':'application/json',...(user ? {authorization:`Bearer ${user}`} : {}),...extra},body:JSON.stringify(body)});
async function initialize(amount=10,user=buyer,requestId=randomUUID(),mode:'live'|'test'='live') {
  const response=await handlers(mode).initialize(request({amount,requestId,returnUrl:CHAPA_RETURN_URL},user));
  return {response,result:await response.json(),requestId};
}
function setState(ref:string,status:string,patch:Record<string,unknown>={}) {
  const current=data.get(ref);current.data={...current.data,status,updated_at:new Date(Date.now()+1).toISOString(),...patch};
}
function event(ref:string,status='success',signature?:string,patch:Record<string,unknown>={}) {
  const payload=JSON.stringify({event:`charge.${status}`,type:'API',tx_ref:ref,mode:'live',status,...patch});
  return new Request('https://edge.test',{method:'POST',body:payload,headers:{'x-chapa-signature':signature || createHmac('sha256',secret).update(payload).digest('hex')}});
}
async function balance(user=buyer) {await service();return(await q('SELECT balance FROM coin_wallets WHERE user_id=$1',[user]))[0]?.balance || 0;}
async function access(kind='post',target=post,user=buyer) {await login(user);return(await q('SELECT circle_content_access($1,$2,auth.uid()) access',[kind,target]))[0].access;}
async function buy(kind='subscription',target=circle,renew=false,expected:string|null=null) {
  await login();return(await q('SELECT purchase_circle_access($1,$2,$3,$4,$5,$6) result',[kind,target,randomUUID(),renew,expected,kind==='subscription' ? 10 : kind==='post' ? 5 : 7]))[0].result;
}

before(async()=>{
  await db.exec(await file('./fixtures/circle-entitlements.sql'));
  await db.exec('ALTER TABLE coin_transactions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now()');
  await db.exec("ALTER TYPE coin_transaction_type ADD VALUE IF NOT EXISTS 'tip_sent'; ALTER TYPE coin_transaction_type ADD VALUE IF NOT EXISTS 'tip_received'");
  await db.exec("CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public,auth,storage TO service_role; ALTER TYPE coin_transaction_type ADD VALUE 'topup'; ALTER TYPE coin_transaction_type ADD VALUE 'withdrawal'; CREATE TABLE coin_topups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,amount integer,payment_method text,status text,created_at timestamptz DEFAULT now()); CREATE TABLE coin_withdrawals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,amount integer,payout_method text,status text DEFAULT 'pending')");
  const original=await file('../../supabase/migrations/20260302072500_4606f06a-a7ce-49ac-aa6d-44e29b3037cb.sql');
  for(const name of ['topup_coins','transfer_coins','spend_coins']) await db.exec(original.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`))![0]);
  for(const name of ['20261102150000_circle_entitlements.sql','20261102151000_circle_content_security.sql','20261102152000_circle_post_rpc_entitlements.sql','20261102153000_circle_separate_purchases.sql','20261104140000_verified_chapa_payments.sql','20261105160000_wallet_payment_audit.sql','20261105161000_wallet_withdrawal_safety.sql','20261105162000_wallet_ledger_integrity.sql','20261105163000_wallet_tip_idempotency.sql','20261106100000_disable_shop_coin_payments.sql']) await db.exec(await file(`../../supabase/migrations/${name}`));
  await db.exec('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role');
});
after(async()=>{await db.close();});
beforeEach(async()=>{
  await db.exec('RESET ROLE; TRUNCATE profiles,circles,circle_members,circle_subscriptions,posts,post_stats,post_unlocks,circle_videos,video_unlocks,circle_resources,coin_wallets,coin_transactions,coin_topups,coin_withdrawals,circle_payment_requests,chapa_payment_intents,chapa_webhook_deliveries,wallet_reconciliation_runs CASCADE');
  await q("INSERT INTO profiles(id,name) VALUES($1,'Buyer'),($2,'Seller'),($3,'Other')",[buyer,seller,other]);
  await q("INSERT INTO circles(id,creator_id,name) VALUES($1,$2,'Circle')",[circle,seller]);
  await q('INSERT INTO posts(id,circle_id,user_id,is_premium,premium_price) VALUES($1,$2,$3,true,5)',[post,circle,seller]);
  await q('INSERT INTO circle_videos(id,circle_id,user_id,is_premium,price) VALUES($1,$2,$3,true,7)',[video,circle,seller]);
  await q('INSERT INTO circle_resources(id,circle_id,uploader_id,is_premium) VALUES($1,$2,$3,true)',[resource,circle,seller]);
  await q('INSERT INTO coin_wallets(user_id,balance) VALUES($1,0),($2,0),($3,0)',[buyer,seller,other]);
  data.clear();verifyCalls=0;initializeCalls=0;unavailable=false;initializedReturnUrl=undefined;payoutCalls=0;payoutUncertain=false;checkoutUncertain=false;
  await login();
});

test('initialization persists owner, exact amount and stable reference before the provider redirect; retries reuse it',async()=>{
  const first=await initialize(),again=await initialize(10,buyer,first.requestId);
  assert.equal(first.response.status,200);assert.equal(again.result.txRef,first.result.txRef);assert.equal(initializeCalls,1);
  const returnUrl=new URL(String(initializedReturnUrl));
  assert.equal(returnUrl.origin,'https://serkle-app-five.vercel.app');assert.equal(returnUrl.pathname,'/verify');
  assert.equal(returnUrl.searchParams.get('tx_ref'),first.result.txRef);
  const intent=await store.get(first.result.txRef);
  assert.equal(intent?.user_id,buyer);assert.equal(intent?.amount,10);assert.equal(intent?.status,'pending');
  assert.equal(await balance(),0);assert.equal(await access(),false);
  const changed=await initialize(20,buyer,first.requestId);assert.equal(changed.response.status,503);
});

test('provider receipt metadata distinguishes an absent fee from an explicitly reported zero and excludes private fields',()=>{
  for(const charge of [undefined,null,'',' ','unknown',-1,Infinity]) assert.equal(providerDetails({data:{charge}}).fee,null);
  assert.equal(providerDetails({data:{charge:'0'}}).fee,'0.00');
  assert.deepEqual(providerDetails({data:{charge:'12.50',payment_method:'telebirr',account_number:'1234567890',secret:'private'}}),{paymentMethod:'telebirr',fee:'12.50'});
});

test('pending and failed provider payments create no wallet credit or Circle access',async()=>{
  const {result}=await initialize();
  let response=await handlers().verify(request({txRef:result.txRef,status:'success',verified:true,success:true}));
  assert.equal((await response.json()).status,'pending');
  setState(result.txRef,'failed');response=await handlers().verify(request({txRef:result.txRef}));
  assert.equal((await response.json()).status,'failed');assert.equal(await balance(),0);
  await assert.rejects(buy(),/Insufficient/);assert.equal(await access(),false);
});

test('a verified Chapa payment funds the wallet once; an explicit server-paid purchase grants every included type',async()=>{
  const {result}=await initialize();setState(result.txRef,'success');
  const response=await handlers().webhook(event(result.txRef));assert.equal(response.status,200);
  assert.equal(await balance(),10);assert.equal(await access(),false,'a top-up cannot silently buy content');
  assert.equal((await buy()).charged,10);assert.equal(await balance(),0);
  for(const [kind,target] of [['post',post],['video',video],['resource',resource]]) assert.equal(await access(kind,target),true);
  assert.equal((await buy('post',post)).charged,0);assert.equal((await buy('video',video)).charged,0);
});

test('signed webhooks, user verification and concurrent replays cannot double-credit',async()=>{
  const {result}=await initialize(20);setState(result.txRef,'success');
  const responses=await Promise.all([handlers().webhook(event(result.txRef)),handlers().webhook(event(result.txRef)),handlers().verify(request({txRef:result.txRef}))]);
  assert.ok(responses.some(response=>response.status===200));assert.ok(responses.every(response=>[200,503].includes(response.status)));assert.equal(await balance(),20);
  await service();assert.equal((await q("SELECT count(*)::int n FROM coin_transactions WHERE type='topup'"))[0].n,1);
  assert.equal((await q('SELECT count(*)::int n FROM coin_topups'))[0].n,1);
  const calls=verifyCalls;assert.equal((await handlers().webhook(event(result.txRef))).status,200);assert.equal(verifyCalls,calls);
});

test('missing/forged signatures and body tampering fail before provider calls or credits',async()=>{
  const {result}=await initialize();setState(result.txRef,'success');
  for(const req of [request({tx_ref:result.txRef},null),event(result.txRef,'success','0'.repeat(64))]) assert.equal((await handlers().webhook(req)).status,401);
  const signed=event(result.txRef),body=await signed.text();
  const tampered=new Request('https://edge.test',{method:'POST',headers:signed.headers,body:body+' '});
  assert.equal((await handlers().webhook(tampered)).status,401);
  assert.equal(verifyCalls,0);assert.equal(await balance(),0);
});

test('the legacy constant-secret signature does not authenticate a forged payload',async()=>{
  const raw=new TextEncoder().encode('{"status":"success"}');
  const signature=createHmac('sha256',secret).update(secret).digest('hex');
  assert.equal(await verifyWebhookSignature(raw,new Headers({'chapa-signature':signature}),secret),false);
});

test('valid signatures still require provider-matched amount, currency, owner reference, environment and timestamp',async()=>{
  for(const patch of [{amount:'11.00'},{currency:'USD'},{tx_ref:'stolen'},{mode:'test'},{reference:''},{updated_at:'2026-01-01 12:00:00'},{status:'partially_refunded'}]) {
    const {result}=await initialize();setState(result.txRef,'success',patch);
    assert.equal((await handlers().webhook(event(result.txRef))).status,502);assert.equal(await balance(),0);
  }
});

test('another account cannot verify a receipt, claim a credit or call service-only fulfillment APIs',async()=>{
  const {result}=await initialize();setState(result.txRef,'success');
  assert.equal((await handlers().verify(request({txRef:result.txRef},other))).status,404);
  assert.equal((await handlers().verify(request({txRef:result.txRef},null))).status,401);
  await login(other);
  await assert.rejects(q("SELECT apply_chapa_verification($1,'succeeded',10,'ETB','live','fake',now())",[result.txRef]),/permission denied/);
  await assert.rejects(q('SELECT reconcile_circle_receipts($1)',[buyer]),/permission denied/);
  await assert.rejects(q("SELECT purchase_circle_access_paid('subscription',$1,$2,false,NULL,10)",[circle,randomUUID()]),/permission denied/);
  await assert.rejects(q("SELECT topup_coins($1,100,'demo')",[other]),/permission denied/);
  await assert.rejects(q("SELECT request_withdrawal($1,-100,'bank_transfer')",[other]),/permission denied/);
  await assert.rejects(q("UPDATE coin_wallets SET balance=100 WHERE user_id=$1",[other]),/permission denied/);
});

test('missed webhooks and provider outages reconcile later from server intents on a fresh client/device',async()=>{
  const {result}=await initialize();setState(result.txRef,'success');unavailable=true;
  assert.equal((await handlers().webhook(event(result.txRef))).status,503);assert.equal(await balance(),0);
  unavailable=false;
  const freshClient=handlers();
  const response=await freshClient.reconcile(request({}));assert.equal(response.status,200);
  assert.equal((await response.json()).results[0].status,'success');assert.equal(await balance(),10);
  await buy();
  await login(null);assert.equal((await q("SELECT circle_content_access('video',$1,auth.uid()) access",[video]))[0].access,false);
  assert.equal(await access('video',video,other),false);
  assert.equal(await access('video',video,buyer),true);
});

test('scheduler reconciliation requires its own secret and never trusts a supplied user ID',async()=>{
  const {result}=await initialize();setState(result.txRef,'success');
  assert.equal((await handlers().reconcile(request({},null,{'x-reconcile-secret':'wrong'}))).status,401);
  assert.equal((await handlers().reconcile(request({user_id:buyer},other))).status,200);assert.equal(await balance(),0);
  assert.equal((await handlers().reconcile(request({},null,{'x-reconcile-secret':scheduler}))).status,200);assert.equal(await balance(),10);
});

test('a refunded top-up reverses its funding once and old success deliveries never credit again',async()=>{
  const {result}=await initialize(20);setState(result.txRef,'success');await handlers().webhook(event(result.txRef));
  setState(result.txRef,'refunded');await handlers().webhook(event(result.txRef,'refunded'));
  assert.equal(await balance(),0);
  setState(result.txRef,'success');await handlers().verify(request({txRef:result.txRef}));
  await handlers().webhook(event(result.txRef));assert.equal(await balance(),0);
  assert.equal((await store.get(result.txRef))?.status,'refunded');
});

test('refund notifications wait for provider confirmation and remain retryable',async()=>{
  const {result}=await initialize();setState(result.txRef,'success');await handlers().webhook(event(result.txRef));
  assert.equal((await handlers().webhook(event(result.txRef,'refunded'))).status,503);assert.equal(await balance(),10);
  setState(result.txRef,'refunded');assert.equal((await handlers().webhook(event(result.txRef,'refunded'))).status,200);assert.equal(await balance(),0);
});

test('external funding reversal does not silently refund independent Circle purchases; spent funding is a wallet debt',async()=>{
  const {result}=await initialize();setState(result.txRef,'success');await handlers().webhook(event(result.txRef));await buy();
  setState(result.txRef,'reversed');await handlers().webhook(event(result.txRef,'reversed'));
  assert.equal(await balance(),-10);assert.equal(await access('resource',resource),true);
  await assert.rejects(buy('video',video,true),/Only subscriptions/);
});

test('Circle receipt refunds revoke only their own grant and never reactivate on reconciliation',async()=>{
  const {result}=await initialize(20);setState(result.txRef,'success');await handlers().webhook(event(result.txRef));
  await buy('post',post);await buy();
  await login(seller);const subscription=(await q("SELECT id FROM circle_payment_requests WHERE kind='subscription'"))[0].id;
  await q('SELECT refund_circle_payment($1)',[subscription]);
  assert.equal(await access('resource',resource),false);assert.equal(await access('post',post),true);
  await handlers().reconcile(request({}));assert.equal(await access('resource',resource),false);assert.equal(await access('post',post),true);
});

test('expiry and explicit renewal use the stored receipt periods, with no replayed renewal charge',async()=>{
  const {result}=await initialize(30);setState(result.txRef,'success');await handlers().webhook(event(result.txRef));await buy();
  await login();const old=(await q('SELECT get_circle_subscription($1) result',[circle]))[0].result;
  const key=randomUUID();await q("SELECT purchase_circle_access('subscription',$1,$2,true,$3,10)",[circle,key,old.expires_at]);
  await q("SELECT purchase_circle_access('subscription',$1,$2,true,$3,10)",[circle,key,old.expires_at]);
  assert.equal(await balance(),10);
  await service();await q("UPDATE circle_subscriptions SET expires_at=now()-interval '1 second' WHERE circle_id=$1",[circle]);
  await q("UPDATE circle_payment_requests SET period_start=now()-interval '2 months',period_end=now()-interval '1 second' WHERE kind='subscription'");
  await handlers().reconcile(request({}));assert.equal(await access(),false);
  assert.equal((await buy()).charged,10);assert.equal(await access(),true);
});

test('missing grants are rebuilt from paid server receipts on restart; unsigned/fabricated receipts grant nothing',async()=>{
  const {result}=await initialize(20);setState(result.txRef,'success');await handlers().webhook(event(result.txRef));await buy('video',video);await buy();
  await service();await q('DELETE FROM video_unlocks WHERE user_id=$1',[buyer]);await q('DELETE FROM circle_subscriptions WHERE user_id=$1',[buyer]);
  const restarted=handlers();await restarted.reconcile(request({}));assert.equal(await access('video',video),true);assert.equal(await access('resource',resource),true);
  await service();assert.equal((await q('SELECT count(*)::int n FROM video_unlocks WHERE user_id=$1',[buyer]))[0].n,1);
  await login(seller);const paidSub=(await q("SELECT id FROM circle_payment_requests WHERE kind='subscription'"))[0].id;
  await q('SELECT refund_circle_payment($1)',[paidSub]);
  assert.equal(await access('video',video),true);assert.equal(await access('resource',resource),false);
  await service();await q("INSERT INTO circle_payment_requests(user_id,seller_id,request_id,kind,target_id,amount) VALUES($1,$2,$3,'post',$4,5)",[other,seller,randomUUID(),post]);
  await restarted.reconcile(request({},other));assert.equal(await access('post',post,other),false);
});

test('refunded receipt truth overrides a stale unlock row even before repair',async()=>{
  const {result}=await initialize();setState(result.txRef,'success');await handlers().webhook(event(result.txRef));await buy('post',post);
  await service();await q("UPDATE circle_payment_requests SET refunded_at=now() WHERE kind='post'");
  assert.equal(await access(),false);await handlers().reconcile(request({}));assert.equal(await access(),false);
});

test('test payments cannot become real spendable coins or premium access',async()=>{
  const {result}=await initialize(10,buyer,randomUUID(),'test');setState(result.txRef,'success');
  const response=await handlers('test').verify(request({txRef:result.txRef}));
  const verified=await response.json();
  assert.equal(verified.status,'test_verified');assert.equal(topUpState(verified),'test');
  writeChapaStorage(pendingChapaKey(buyer),result.txRef);recordTopUpResult(buyer,verified);
  assert.equal(readChapaStorage(pendingChapaKey(buyer)),null);
  const recovered=await handlers('test').verify(request({}));
  assert.equal((await recovered.json()).status,'test_verified');assert.equal(await balance(),0);assert.equal(await access(),false);
  assert.equal((await handlers().webhook(event(result.txRef,'success',undefined,{mode:'test'}))).status,409);
});

test('checkout redirects carry only the persisted reference, regardless of client query parameters',async()=>{
  const response=await handlers().initialize(request({amount:10,requestId:randomUUID(),returnUrl:`${CHAPA_RETURN_URL}?tx_ref=forged&status=success#anything`}));
  const result=await response.json();assert.equal(response.status,200);
  const redirect=new URL(String(initializedReturnUrl));
  assert.equal(redirect.origin,'https://serkle-app-five.vercel.app');assert.equal(redirect.pathname,'/verify');
  assert.deepEqual([...redirect.searchParams],[['tx_ref',result.txRef]]);assert.equal(redirect.hash,'');
});

test('a return without browser storage recovers the only recent owned receipt, including an already fulfilled payment',async()=>{
  const {result}=await initialize();setState(result.txRef,'success');
  await handlers().webhook(event(result.txRef));assert.equal(await balance(),10);
  const response=await handlers().verify(request({})),verified=await response.json();
  assert.equal(response.status,200);assert.equal(verified.txRef,result.txRef);assert.equal(topUpState(verified),'success');
  assert.equal(await balance(),10,'recovery must not issue another credit');
  const outsider=await handlers().verify(request({user_id:buyer},other));
  const unknown=await outsider.json();assert.equal(unknown.status,'unknown');assert.equal(unknown.userId,other);assert.deepEqual(unknown.candidates,[]);
});

test('ambiguous returns require an explicit receipt selection and never pick another payment to credit',async()=>{
  const first=await initialize(10),second=await initialize(20);setState(first.result.txRef,'success');setState(second.result.txRef,'success');
  const response=await handlers().verify(request({})),selection=await response.json();
  assert.equal(selection.status,'selection_required');assert.equal(selection.userId,buyer);assert.equal(verifyCalls,0);assert.equal(await balance(),0);
  assert.deepEqual(new Set(selection.candidates.map((candidate:any)=>candidate.txRef)),new Set([first.result.txRef,second.result.txRef]));
  const chosen=await handlers().verify(request({txRef:second.result.txRef}));assert.equal((await chosen.json()).status,'success');
  assert.equal(await balance(),20);assert.equal((await store.get(first.result.txRef))?.credited_at,null);
});

test('missing or expired recovery candidates remain unknown without treating an old receipt as the current payment',async()=>{
  let response=await handlers().verify(request({}));assert.equal((await response.json()).status,'unknown');
  const {result}=await initialize();setState(result.txRef,'success');
  await service();await q("UPDATE chapa_payment_intents SET created_at=now()-interval '2 days' WHERE tx_ref=$1",[result.txRef]);
  response=await handlers().verify(request({}));assert.equal((await response.json()).status,'unknown');assert.equal(verifyCalls,0);assert.equal(await balance(),0);
  response=await handlers().verify(request({txRef:result.txRef}));assert.equal((await response.json()).status,'success');assert.equal(await balance(),10);
});

test('a failure during fulfillment rolls back the entire credit and can be reconciled safely later',async()=>{
  const {result}=await initialize();setState(result.txRef,'success');
  await db.exec("RESET ROLE; CREATE FUNCTION reject_chapa_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Ledger unavailable'; END $$; CREATE TRIGGER reject_chapa_ledger BEFORE INSERT ON coin_transactions FOR EACH ROW EXECUTE FUNCTION reject_chapa_ledger()");
  try {assert.equal((await handlers().webhook(event(result.txRef))).status,503);assert.equal(await balance(),0);assert.equal((await store.get(result.txRef))?.credited_at,null);}
  finally {await db.exec('RESET ROLE; DROP TRIGGER reject_chapa_ledger ON coin_transactions; DROP FUNCTION reject_chapa_ledger()');}
  assert.equal((await handlers().webhook(event(result.txRef))).status,200);assert.equal(await balance(),10);
});

test('client pending/success presentation and login return never trust a bare success status',()=>{
  assert.equal(topUpState({status:'success'}),'pending');assert.equal(topUpState({status:'success',success:true,verified:false}),'pending');
  assert.equal(topUpState({status:'success',success:true,verified:true}),'success');assert.equal(topUpState({status:'refunded',verified:true}),'failed');
  assert.notEqual(pendingChapaKey(buyer),pendingChapaKey(other));assert.notEqual(chapaRequestKey(buyer,10),chapaRequestKey(other,10));
  const path='/verify?trx_ref=serkle-123';assert.equal(authReturnPath(circleLoginPath(path).split('?')[1]),path);
});

test('pending API evidence cannot fulfill a signed success event until reconciliation confirms payment',async()=>{
  const {result}=await initialize();
  assert.equal((await handlers().webhook(event(result.txRef))).status,503);assert.equal(await balance(),0);
  setState(result.txRef,'success');assert.equal((await handlers().webhook(event(result.txRef))).status,200);assert.equal(await balance(),10);
});

test('stale failed/pending evidence and reused provider references cannot change settled value',async()=>{
  const first=await initialize();setState(first.result.txRef,'success');await handlers().webhook(event(first.result.txRef));
  const settled=data.get(first.result.txRef).data;
  setState(first.result.txRef,'failed',{updated_at:new Date(Date.parse(settled.updated_at)-1000).toISOString()});
  const response=await handlers().verify(request({txRef:first.result.txRef}));assert.equal((await response.json()).status,'success');assert.equal(await balance(),10);
  const second=await initialize(10,other);setState(second.result.txRef,'success',{reference:settled.reference});
  assert.equal((await handlers().verify(request({txRef:second.result.txRef},other))).status,503);assert.equal(await balance(other),0);
});

test('reconciliation preserves cancellation, unexpired legacy grants and independent paid terms',async()=>{
  const {result}=await initialize();setState(result.txRef,'success');await handlers().webhook(event(result.txRef));await buy();
  await login();await q('SELECT cancel_circle_subscription($1)',[circle]);await handlers().reconcile(request({}));
  await login();assert.equal((await q('SELECT get_circle_subscription($1) result',[circle]))[0].result.cancel_at_period_end,true);assert.equal(await access(),true);
  await service();await q('DELETE FROM circle_payment_requests WHERE user_id=$1',[other]);
  await q('INSERT INTO circle_subscriptions(circle_id,user_id) VALUES($1,$2)',[circle,other]);
  await handlers().reconcile(request({},other));assert.equal(await access('resource',resource,other),true);
});

test('the old unbound withdrawal debit is disabled even for server callers',async()=>{
  await service();await assert.rejects(q("SELECT request_withdrawal($1,-10,'chapa_bank_transfer')",[buyer]),/recorded withdrawal/);
  await assert.rejects(q("SELECT request_withdrawal($1,10,'chapa_bank_transfer')",[buyer]),/recorded withdrawal/);
  assert.equal(await balance(),0);assert.equal(await access(),false);
});

test('uncertain checkout responses remain recorded and later verification credits the same reference once',async()=>{
  checkoutUncertain=true;
  const {response,result}=await initialize();assert.equal(response.status,202);assert.ok(result.txRef);
  const intent=await store.get(result.txRef);assert.equal((intent as any).checkout_state,'error');assert.equal((intent as any).last_error_code,'checkout_unconfirmed');
  assert.equal(await balance(),0);checkoutUncertain=false;setState(result.txRef,'success');
  const verified=await handlers().verify(request({txRef:result.txRef}));assert.equal((await verified.json()).status,'success');
  assert.equal(initializeCalls,1);assert.equal(await balance(),10);
  await login();const receipt=(await q('SELECT get_wallet_payment_receipt($1) result',[intent!.id]))[0].result;
  assert.ok(receipt.events.some((entry:any)=>entry.event_type==='check_error'));assert.equal(receipt.ledger.length,1);
});

test('simultaneous initialization retries create one provider checkout and one recorded intent',async()=>{
  const key=randomUUID();
  const results=await Promise.all([initialize(10,buyer,key),initialize(10,buyer,key)]);
  assert.equal(new Set(results.map(item=>item.result.txRef)).size,1);assert.equal(initializeCalls,1);
  assert.ok(results.every(item=>[200,202].includes(item.response.status)));
});

test('receipts preserve test, failed and pending attempts plus verified method, fee and a tamper-resistant timeline',async()=>{
  const {result}=await initialize(500,buyer,randomUUID(),'test');setState(result.txRef,'success',{payment_method:'telebirr',charge:'12.50'});
  await handlers('test').verify(request({txRef:result.txRef}));
  const intent=await store.get(result.txRef);
  await login();const receipt=(await q('SELECT get_wallet_payment_receipt($1) result',[intent!.id]))[0].result;
  assert.equal(receipt.payment.payment_method,'telebirr');assert.equal(receipt.payment.provider_fee,12.5);assert.equal(receipt.payment.mode,'test');assert.equal(receipt.ledger.length,0);
  assert.ok(receipt.events.some((entry:any)=>entry.event_type==='verified'));assert.ok(receipt.events.some((entry:any)=>entry.event_type==='check_started'));
  const eventId=receipt.events[0].id;
  await assert.rejects(q("UPDATE wallet_payment_events SET message='forged' WHERE id=$1",[eventId]),/permission denied/);
  await service();await assert.rejects(q('DELETE FROM wallet_payment_events WHERE id=$1',[eventId]),/cannot be edited or deleted/);
  await login(other);await assert.rejects(q('SELECT get_wallet_payment_receipt($1)',[intent!.id]),/not found/);
  assert.equal((await q('SELECT * FROM wallet_payment_events')).length,0);
  await assert.rejects(q("SELECT record_chapa_error($1,'verification','fake','fake','user',NULL)",[result.txRef]),/permission denied/);
  await login(null);await assert.rejects(q('SELECT get_wallet_payment_history()'),/permission denied/);
});

test('history and ledger cursors include more than 50 records without dropping timestamp ties or leaking another account',async()=>{
  await service();await q("INSERT INTO chapa_payment_intents(user_id,request_id,tx_ref,amount,mode,created_at) SELECT $1,gen_random_uuid(),'history-'||gen_random_uuid(),10,CASE WHEN n%2=0 THEN 'test' ELSE 'live' END,'2026-11-05T00:00:00Z' FROM generate_series(1,61) n",[buyer]);
  await initialize(10,other);
  await login();let cursor:any=null;const seen:string[]=[];
  do {
    const page=(await q('SELECT get_wallet_payment_history($1,$2,20,$3) result',[cursor?.created_at || null,cursor?.id || null,'all']))[0].result;
    assert.equal(page.userId,buyer);const rows=page.items.slice(0,20);seen.push(...rows.map((row:any)=>row.id));
    cursor=page.items.length>20 ? rows.at(-1) : null;
  } while(cursor);
  assert.equal(seen.length,61);assert.equal(new Set(seen).size,61);
  const filtered=(await q("SELECT get_wallet_payment_history(NULL,NULL,50,'test') result"))[0].result.items;
  assert.equal(filtered.length,30);assert.ok(filtered.every((row:any)=>row.mode==='test'));
  await service();await q("INSERT INTO coin_transactions(user_id,amount,type,description,balance_after,created_at) SELECT $1,0,'topup','History fixture',0,'2026-11-05T00:00:00Z' FROM generate_series(1,61)",[buyer]);
  await login();cursor=null;const ledger:string[]=[];
  do {const page=(await q('SELECT get_wallet_activity($1,$2,20) result',[cursor?.created_at || null,cursor?.id || null]))[0].result;
    const rows=page.items.slice(0,20);ledger.push(...rows.map((row:any)=>row.id));cursor=page.items.length>20 ? rows.at(-1) : null;
  } while(cursor);
  assert.equal(ledger.length,61);assert.equal(new Set(ledger).size,61);
});

test('provider mismatches stay visible for review through outages and can recover only from matching evidence',async()=>{
  const {result}=await initialize();setState(result.txRef,'success',{amount:20});
  assert.equal((await handlers().verify(request({txRef:result.txRef}))).status,502);
  assert.equal((await store.get(result.txRef) as any).review_required,true);assert.equal(await balance(),0);
  unavailable=true;await handlers().verify(request({txRef:result.txRef}));assert.equal((await store.get(result.txRef) as any).review_required,true);
  unavailable=false;setState(result.txRef,'success',{amount:10});await handlers().verify(request({txRef:result.txRef}));
  assert.equal((await store.get(result.txRef) as any).review_required,false);assert.equal(await balance(),10);
});

test('failed-at-last-check payments are scheduled promptly and later success is fulfilled without another checkout',async()=>{
  const {result}=await initialize();setState(result.txRef,'failed');await handlers().verify(request({txRef:result.txRef}));
  const row:any=await store.get(result.txRef);assert.ok(Date.parse(row.next_check_at)-Date.now()<=61000);
  setState(result.txRef,'success');await handlers().verify(request({txRef:result.txRef}));assert.equal(await balance(),10);assert.equal(initializeCalls,1);
});

test('manual status checks are rate limited before calling Chapa and failed checks are not counted as wallet credits',async()=>{
  const {result}=await initialize();
  for(let i=0;i<12;i++) assert.equal((await handlers().verify(request({txRef:result.txRef}))).status,200);
  const response=await handlers().verify(request({txRef:result.txRef}));assert.equal(response.status,429);assert.equal(verifyCalls,12);assert.equal(await balance(),0);
});

test('reconciliation reserves capacity for settled reversals while prioritizing uncredited receipts and skipping leased work',async()=>{
  await service();await q("INSERT INTO chapa_payment_intents(user_id,request_id,tx_ref,amount,mode,status,credited_at,next_check_at) SELECT $1,gen_random_uuid(),'due-'||gen_random_uuid(),10,'live',CASE WHEN n<=10 THEN 'succeeded' ELSE 'pending' END,CASE WHEN n<=10 THEN now() END,now()-interval '1 hour' FROM generate_series(1,50) n",[buyer]);
  let rows=await q("SELECT * FROM due_wallet_payments(ARRAY['live'],NULL,25)");assert.equal(rows.length,25);assert.equal(rows.filter(row=>row.status==='succeeded').length,5);
  await q("UPDATE chapa_payment_intents SET check_lease_until=now()+interval '1 minute' WHERE id=$1",[rows[0].id]);
  const skipped=rows[0].id;rows=await q("SELECT * FROM due_wallet_payments(ARRAY['live'],NULL,25)");assert.ok(rows.every(row=>row.id!==skipped));
  await login(other);await assert.rejects(q("SELECT * FROM due_wallet_payments(ARRAY['live'],NULL,25)"),/permission denied/);
});

test('both environment receipts can reconcile when their server keys are configured; a test receipt never funds live money',async()=>{
  const live=await initialize(10),sandbox=await initialize(20,buyer,randomUUID(),'test');setState(live.result.txRef,'success');setState(sandbox.result.txRef,'success');
  const response=await handlers('test',['live','test']).reconcile(request({},null,{'x-reconcile-secret':scheduler}));
  assert.equal(response.status,200);assert.equal(await balance(),10);
  await login();const history=(await q('SELECT get_wallet_payment_history() result'))[0].result;
  assert.ok(history.automaticChecks.live);assert.ok(history.automaticChecks.test);
  assert.deepEqual(new Set(history.items.map((row:any)=>row.mode)),new Set(['test','live']));
});

const withdrawalBody=(amount:number,mode:'live'|'test',requestId=randomUUID())=>({amount,expectedMode:mode,requestId,bankCode:855,accountNumber:'1234567890',accountName:'Fixture Buyer'});
async function withdraw(amount=30,mode:'live'|'test'='live',key=randomUUID()) {
  const response=await transfers(mode)(request(withdrawalBody(amount,mode,key)));return {response,result:await response.json(),key};
}
async function seedBalance(amount=100) {await service();await q("WITH funded AS (UPDATE coin_wallets SET balance=balance+$2 WHERE user_id=$1 RETURNING balance) INSERT INTO coin_transactions(user_id,amount,type,description,balance_after) SELECT $1,$2,'topup','Fixture funding',balance FROM funded",[buyer,amount]);}

test('live withdrawals reserve once, bind the ledger to their durable receipt and never resend after an uncertain response',async()=>{
  await seedBalance();payoutUncertain=true;const first=await withdraw();assert.equal(first.response.status,202);assert.equal(await balance(),70);assert.equal(payoutCalls,1);
  const again=await withdraw(30,'live',first.key);assert.equal(again.result.txRef,first.result.txRef);assert.equal(payoutCalls,1);assert.equal(await balance(),70);
  unavailable=true;await handlers().verify(request({txRef:first.result.txRef}));assert.equal(await balance(),70,'timeouts must not restore a possibly completed payout');
  unavailable=false;setState(first.result.txRef,'success');const verified=await handlers().verify(request({txRef:first.result.txRef}));
  assert.equal((await verified.json()).status,'withdrawal_completed');assert.equal(await balance(),70);assert.equal(payoutCalls,1);
  const p=await store.get(first.result.txRef);await login();const receipt=(await q('SELECT get_wallet_payment_receipt($1) result',[p!.id]))[0].result;
  assert.equal(receipt.ledger.length,1);assert.equal(receipt.ledger[0].reference_id,p!.id);assert.equal(receipt.ledger[0].amount,-30);
  assert.ok(receipt.events.some(entry=>entry.event_type==='funds_reserved'));
  assert.ok(receipt.events.some(entry=>entry.event_type==='payout_submission_started'));
  assert.equal(JSON.stringify(receipt).includes('1234567890'),false,'full account details must not enter receipts or audit events');
});

test('simultaneous withdrawal requests with one request ID reserve and submit once',async()=>{
  await seedBalance();const key=randomUUID();
  const attempts=await Promise.all([withdraw(30,'live',key),withdraw(30,'live',key),withdraw(30,'live',key)]);
  assert.ok(attempts.every(attempt=>attempt.result.txRef===attempts[0].result.txRef));
  assert.equal(payoutCalls,1);assert.equal(await balance(),70);
});

test('payout webhooks require a signature and requery Chapa before restoring funds exactly once',async()=>{
  await seedBalance();const {result}=await withdraw();
  const body=JSON.stringify({event:'payout.failed',type:'Payout',reference:result.txRef,status:'failed'});
  const payoutEvent=()=>new Request('https://edge.test',{method:'POST',body,headers:{'x-chapa-signature':createHmac('sha256',secret).update(body).digest('hex')}});
  assert.equal((await handlers().webhook(new Request('https://edge.test',{method:'POST',body}))).status,401);
  assert.equal((await handlers().webhook(payoutEvent())).status,503,'an event cannot override pending provider evidence');
  assert.equal(await balance(),70);
  setState(result.txRef,'failed');assert.equal((await handlers().webhook(payoutEvent())).status,200);assert.equal(await balance(),100);
  const checks=verifyCalls;assert.equal((await handlers().webhook(payoutEvent())).status,200);assert.equal(verifyCalls,checks);
  const p=await store.get(result.txRef);await login();const receipt=(await q('SELECT get_wallet_payment_receipt($1) result',[p!.id]))[0].result;
  assert.ok(receipt.events.some(entry=>entry.event_type==='funds_restored' && entry.source==='webhook'));
  assert.equal(receipt.ledger.reduce((sum,entry)=>sum+entry.amount,0),0);
});

test('a completed payout cannot be refunded by a later failure; only a verified reversal returns its reserve',async()=>{
  await seedBalance();const {result}=await withdraw();setState(result.txRef,'success');await handlers().verify(request({txRef:result.txRef}));
  setState(result.txRef,'failed');await handlers().verify(request({txRef:result.txRef}));assert.equal(await balance(),70);
  assert.equal((await store.get(result.txRef))!.review_required,true);
  setState(result.txRef,'failed',{account_number:'9999999999'});await handlers().verify(request({txRef:result.txRef}));
  setState(result.txRef,'success',{account_number:'1234567890'});await handlers().verify(request({txRef:result.txRef}));
  assert.equal((await store.get(result.txRef) as any).review_code,'withdrawal_state_conflict','transient mismatches cannot clear a prior settlement conflict');
  setState(result.txRef,'reversed');await handlers().verify(request({txRef:result.txRef}));assert.equal(await balance(),100);
  await handlers().verify(request({txRef:result.txRef}));assert.equal(await balance(),100);assert.equal(payoutCalls,1);
});

test('withdrawal configuration requires the account JWT and preflight cannot initiate a payout',async()=>{
  const preflight=await transfers()(new Request('https://edge.test',{method:'OPTIONS'}));assert.equal(preflight.status,204);
  assert.ok(preflight.headers.get('access-control-allow-origin'));
  const url='https://edge.test?action=configuration';
  assert.equal((await transfers()(new Request(url))).status,401);
  const configuration=await transfers('test')(new Request(url,{headers:{authorization:`Bearer ${buyer}`}}));
  assert.deepEqual(await configuration.json(),{success:true,userId:buyer,mode:'test'});assert.equal(payoutCalls,0);
});

test('a verified payout failure returns reserved funds once; later contradictory success needs review without another debit',async()=>{
  await seedBalance();const {result}=await withdraw();setState(result.txRef,'failed');
  let response=await handlers().verify(request({txRef:result.txRef}));assert.equal((await response.json()).status,'withdrawal_restored');assert.equal(await balance(),100);
  await handlers().verify(request({txRef:result.txRef}));assert.equal(await balance(),100);
  setState(result.txRef,'success');response=await handlers().verify(request({txRef:result.txRef}));assert.equal((await response.json()).reviewRequired,true);assert.equal(await balance(),100);
  const p=await store.get(result.txRef);await service();assert.equal((await q("SELECT count(*)::integer count FROM coin_transactions WHERE reference_id=$1 AND type='refund'",[p!.id]))[0].count,1);assert.equal(payoutCalls,1);
});

test('test withdrawals create auditable receipts while leaving a zero live wallet unchanged',async()=>{
  const {result}=await withdraw(500,'test');assert.equal(await balance(),0);setState(result.txRef,'success');
  const response=await handlers('test').verify(request({txRef:result.txRef}));assert.equal((await response.json()).status,'test_withdrawal_verified');assert.equal(await balance(),0);
  await login();const history=(await q('SELECT get_wallet_payment_history() result'))[0].result;
  assert.equal(history.items[0].kind,'withdrawal');assert.equal(history.items[0].mode,'test');
  const receipt=(await q('SELECT get_wallet_payment_receipt($1) result',[history.items[0].id]))[0].result;assert.equal(receipt.ledger.length,0);
});

test('wrong payout destinations, changed idempotency parameters and a test/live consent mismatch cannot move more money',async()=>{
  await seedBalance();const first=await withdraw();
  const changed=await transfers()(request({...withdrawalBody(40,'live',first.key)}));assert.equal(changed.status,503);assert.equal(payoutCalls,1);assert.equal(await balance(),70);
  const wrongMode=await transfers()(request(withdrawalBody(30,'test')));assert.equal(wrongMode.status,409);assert.equal(await balance(),70);
  setState(first.result.txRef,'failed',{account_number:'9999999999'});const mismatch=await handlers().verify(request({txRef:first.result.txRef}));assert.equal(mismatch.status,503);assert.equal(await balance(),70);
  assert.equal((await store.get(first.result.txRef) as any).review_required,true);
});

test('insufficient funds create a failed receipt without sending a payout or debiting the wallet',async()=>{
  const {result}=await withdraw();assert.equal(result.status,'failed');assert.equal(payoutCalls,0);assert.equal(await balance(),0);
  await login();assert.equal((await q('SELECT get_wallet_payment_history() result'))[0].result.items.length,1);
});

test('a crash before the permanent submission marker safely restores unsent reserves without a provider request',async()=>{
  await seedBalance();const destination=createHash('sha256').update('855:1234567890').digest('hex');
  const p=await store.beginWithdrawal(buyer,randomUUID(),30,'live','0'.repeat(64),destination,855,'Fixture Bank ••••7890');assert.equal(await balance(),70);
  await service();await q("UPDATE chapa_payment_intents SET created_at=now()-interval '3 minutes' WHERE id=$1",[p.id]);
  const response=await handlers().verify(request({txRef:p.tx_ref}));assert.equal((await response.json()).status,'withdrawal_restored');assert.equal(await balance(),100);assert.equal(verifyCalls,0);assert.equal(payoutCalls,0);
  await handlers().verify(request({txRef:p.tx_ref}));assert.equal(await balance(),100);
});

test('the top-up fulfillment function cannot turn a reserved withdrawal into a spendable credit',async()=>{
  await seedBalance();const {result}=await withdraw();await service();
  await assert.rejects(q("SELECT apply_chapa_verification($1,'succeeded',30,'ETB','live','fake-topup',now())",[result.txRef]),/withdrawal cannot receive a top-up credit/);
  assert.equal(await balance(),70);
});

test('tip retries transfer coins once, keep both ledger entries linked and reject forged types or fractional amounts',async()=>{
  await seedBalance();await login();const key=randomUUID();
  const first=(await q('SELECT wallet_transfer_tip($1,$2,20,NULL,$3) result',[key,seller,'Fixture tip']))[0].result;
  const replay=(await q('SELECT wallet_transfer_tip($1,$2,20,NULL,$3) result',[key,seller,'Fixture tip']))[0].result;
  assert.equal(first.success,true);assert.equal(replay.replayed,true);assert.equal(first.operationId,replay.operationId);
  assert.equal(await balance(),80);assert.equal(await balance(seller),20);
  await service();const entries=await q('SELECT * FROM coin_transactions WHERE operation_id=$1',[first.operationId]);assert.equal(entries.length,2);assert.equal(entries.reduce((sum,row)=>sum+row.amount,0),0);
  await login();await assert.rejects(q('SELECT wallet_transfer_tip($1,$2,20.5)',[randomUUID(),seller]),/Invalid tip/);
  await assert.rejects(q("SELECT transfer_coins($1,$2,20,'topup','refund',NULL,'forged')",[buyer,seller]),/permission denied/);
  await assert.rejects(q('SELECT wallet_transfer_tip($1,$2,30,NULL,$3)',[key,seller,'Different amount']),/different tip/);
  assert.equal(await balance(),80);
});

test('paused Shop checkout rejects legacy coin debits for every API role and preserves the wallet and ledger',async()=>{
  await seedBalance();await service();
  const entries=(await q('SELECT count(*)::int count FROM coin_transactions'))[0].count;
  for(const user of [buyer,other,null]) {
    await login(user);
    await assert.rejects(q("SELECT spend_coins($1,20,'premium_unlock',NULL,'Shop purchase')",[buyer]),/permission denied/);
  }
  await service();await assert.rejects(q("SELECT spend_coins($1,20,'premium_unlock',NULL,'Shop purchase')",[buyer]),/permission denied/);
  await db.exec('RESET ROLE');
  await assert.rejects(q("SELECT spend_coins($1,20,'premium_unlock',NULL,'Shop purchase')",[buyer]),/Shop coin payments are temporarily unavailable/);
  assert.equal(await balance(),100);
  assert.equal((await q('SELECT count(*)::int count FROM coin_transactions'))[0].count,entries);
});

test('wallet balance mutations without matching journal entries fail at commit and existing journal rows cannot be altered',async()=>{
  await service();await assert.rejects(q('UPDATE coin_wallets SET balance=balance+1 WHERE user_id=$1',[buyer]),/does not match/);
  assert.equal(await balance(),0);
  await seedBalance();await service();await assert.rejects(q('UPDATE coin_transactions SET amount=999 WHERE user_id=$1',[buyer]),/cannot be edited or deleted/);
  await assert.rejects(q('DELETE FROM coin_transactions WHERE user_id=$1',[buyer]),/cannot be edited or deleted/);
  await login();const activity=(await q('SELECT get_wallet_activity() result'))[0].result;
  assert.equal(activity.integrity.status,'balanced');assert.equal(activity.integrity.recordedBalance,100);assert.equal(activity.integrity.expectedBalance,100);
});

test('operator audit queries identify stale receipts without falsely flagging a refund that arrived before any credit',async()=>{
  const {result}=await initialize(10);setState(result.txRef,'refunded');await handlers().verify(request({txRef:result.txRef}));
  await seedBalance();const payout=await withdraw();await service();
  await q("UPDATE chapa_payment_intents SET created_at=now()-interval '20 minutes' WHERE tx_ref=$1",[payout.result.txRef]);
  const audit=await db.exec(await file('../../supabase/setup/wallet-audit-operations.sql'));
  assert.equal(audit[2].rows.length,1,'a long-pending payout appears for operator review');
  assert.equal(audit[3].rows.length,0,'per-receipt journal totals match funding and withdrawal state');
  assert.equal(audit[4].rows.length,0,'account balance and journal match');
  assert.equal(audit[5].rows.length,0,'the current payout has a durable receipt binding');
});

test('simultaneous purchase retries restore a missing paid subscription instead of charging again',async()=>{
  const {result}=await initialize(30);setState(result.txRef,'success');await handlers().webhook(event(result.txRef));await buy();
  await service();await q('DELETE FROM circle_subscriptions WHERE user_id=$1',[buyer]);
  await login();
  const results=await Promise.all([randomUUID(),randomUUID()].map(key=>q("SELECT purchase_circle_access('subscription',$1,$2,false,NULL,10) result",[circle,key])));
  assert.ok(results.every(rows=>rows[0].result.charged===0));assert.equal(await balance(),20);assert.equal(await access(),true);
  await service();assert.equal((await q("SELECT count(*)::int n FROM circle_payment_requests WHERE kind='subscription' AND amount>0"))[0].n,1);
});

test('missing one-time entitlements are restored before another purchase or renewal quote is evaluated',async()=>{
  const {result}=await initialize(20);setState(result.txRef,'success');await handlers().webhook(event(result.txRef));await buy('video',video);
  await service();await q('DELETE FROM video_unlocks WHERE user_id=$1',[buyer]);
  assert.equal((await buy('video',video)).charged,0);assert.equal(await balance(),13);assert.equal(await access('video',video),true);
});

test('a response from the previous account cannot clear another account’s pending payment',()=>{
  // The in-memory fallback also supports browsers with unavailable storage.
  writeChapaStorage(chapaRequestKey(other,10),'other-account-request');
  recordTopUpResult(other,{userId:buyer,status:'success',success:true,verified:true,amount:10,txRef:'old-account'});
  assert.equal(readChapaStorage(chapaRequestKey(other,10)),'other-account-request');
});

test('a refund discovered before first fulfillment blocks all later success retries',async()=>{
  const {result}=await initialize();setState(result.txRef,'refunded');
  assert.equal((await handlers().webhook(event(result.txRef,'refunded'))).status,200);assert.equal(await balance(),0);
  setState(result.txRef,'success');await handlers().verify(request({txRef:result.txRef}));
  assert.equal(await balance(),0);assert.equal(await access(),false);
});

test('invalid amounts and unapproved return origins cannot initiate a checkout',async()=>{
  for(const amount of [0,-10,10.5,'10abc',1000001]) {
    const response=await handlers().initialize(request({amount,requestId:randomUUID(),returnUrl:CHAPA_RETURN_URL}));
    assert.equal(response.status,400);
  }
  const response=await handlers().initialize(request({amount:10,requestId:randomUUID(),returnUrl:'https://attacker.test/verify'}));
  assert.equal(response.status,400);assert.equal(initializeCalls,0);assert.equal(await balance(),0);
});
