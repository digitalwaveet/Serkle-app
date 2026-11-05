import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID,createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { after,before,beforeEach,test } from 'node:test';
import { createChapaHandlers,normalizeVerification,verifyWebhookSignature,PaymentError,type ChapaStore,type ChapaIntent } from '../../supabase/functions/_shared/chapa.ts';
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
let verifyCalls=0,initializeCalls=0,unavailable=false,initializedReturnUrl:unknown;
const store:ChapaStore={
  begin:async(user,request,amount,mode)=>{await service();return(await q('SELECT begin_chapa_payment($1,$2,$3,$4) result',[user,request,amount,mode]))[0].result;},
  get:async ref=>{await service();return(await q('SELECT * FROM chapa_payment_intents WHERE tx_ref=$1',[ref]))[0] || null;},
  setCheckout:async(ref,url)=>{await service();await q('UPDATE chapa_payment_intents SET checkout_url=$2 WHERE tx_ref=$1',[ref,url]);},
  apply:async evidence=>{await service();return(await q('SELECT apply_chapa_verification($1,$2,$3,$4,$5,$6,$7) result',Object.values(evidence)))[0].result;},
  due:async user=>{await service();return q("SELECT * FROM chapa_payment_intents WHERE ($1::uuid IS NULL OR user_id=$1) AND reversed_at IS NULL ORDER BY created_at LIMIT 25",[user || null]);},
  error:async(ref,message)=>{await service();await q('UPDATE chapa_payment_intents SET last_error=$2 WHERE tx_ref=$1',[ref,message]);},
  delivery:async(hash,ref,mode)=>{await service();await q('INSERT INTO chapa_webhook_deliveries(body_hash,tx_ref,mode) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[hash,ref,mode]);return!!(await q('SELECT processed_at FROM chapa_webhook_deliveries WHERE body_hash=$1',[hash]))[0].processed_at;},
  finishDelivery:async hash=>{await service();await q('UPDATE chapa_webhook_deliveries SET processed_at=now() WHERE body_hash=$1',[hash]);},
  reconcileGrants:async user=>{await service();await q('SELECT reconcile_circle_receipts($1)',[user]);},
};
function handlers(mode:'live'|'test'='live') {
  return createChapaHandlers({store,mode,origins:['https://serkle-app-five.vercel.app'],webhookSecret:secret,reconcileSecret:scheduler,
    authenticate:async request=>{
      const user=request.headers.get('authorization')?.replace('Bearer ','');
      if(![buyer,seller,other].includes(user || '')) throw new PaymentError('Authentication required',401);
      return{id:user!,email:'buyer@example.test'};
    },
    initialize:async payload=>{
      initializeCalls++;
      initializedReturnUrl=payload.return_url;
      data.set(payload.tx_ref as string,{status:'success',data:{tx_ref:payload.tx_ref,amount:payload.amount,currency:'ETB',mode,status:'pending',reference:`provider-${payload.tx_ref}`,updated_at:new Date().toISOString()}});
      return `https://checkout.chapa.co/checkout/${payload.tx_ref}`;
    },
    verify:async intent=>{verifyCalls++;if(unavailable)throw new Error('Provider unavailable');return data.get(intent.tx_ref);},
  });
}
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
  await db.exec("CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public,auth,storage TO service_role; ALTER TYPE coin_transaction_type ADD VALUE 'topup'; ALTER TYPE coin_transaction_type ADD VALUE 'withdrawal'; CREATE TABLE coin_topups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,amount integer,payment_method text,status text,created_at timestamptz DEFAULT now()); CREATE TABLE coin_withdrawals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,amount integer,payout_method text,status text DEFAULT 'pending')");
  const original=await file('../../supabase/migrations/20260302072500_4606f06a-a7ce-49ac-aa6d-44e29b3037cb.sql');
  for(const name of ['topup_coins','transfer_coins','spend_coins']) await db.exec(original.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`))![0]);
  for(const name of ['20261102150000_circle_entitlements.sql','20261102151000_circle_content_security.sql','20261102152000_circle_post_rpc_entitlements.sql','20261102153000_circle_separate_purchases.sql','20261104140000_verified_chapa_payments.sql']) await db.exec(await file(`../../supabase/migrations/${name}`));
  await db.exec('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role');
});
after(async()=>{await db.close();});
beforeEach(async()=>{
  await db.exec('RESET ROLE; TRUNCATE profiles,circles,circle_members,circle_subscriptions,posts,post_stats,post_unlocks,circle_videos,video_unlocks,circle_resources,coin_wallets,coin_transactions,coin_topups,coin_withdrawals,circle_payment_requests,chapa_payment_intents,chapa_webhook_deliveries CASCADE');
  await q("INSERT INTO profiles(id,name) VALUES($1,'Buyer'),($2,'Seller'),($3,'Other')",[buyer,seller,other]);
  await q("INSERT INTO circles(id,creator_id,name) VALUES($1,$2,'Circle')",[circle,seller]);
  await q('INSERT INTO posts(id,circle_id,user_id,is_premium,premium_price) VALUES($1,$2,$3,true,5)',[post,circle,seller]);
  await q('INSERT INTO circle_videos(id,circle_id,user_id,is_premium,price) VALUES($1,$2,$3,true,7)',[video,circle,seller]);
  await q('INSERT INTO circle_resources(id,circle_id,uploader_id,is_premium) VALUES($1,$2,$3,true)',[resource,circle,seller]);
  await q('INSERT INTO coin_wallets(user_id,balance) VALUES($1,0),($2,0),($3,0)',[buyer,seller,other]);
  data.clear();verifyCalls=0;initializeCalls=0;unavailable=false;initializedReturnUrl=undefined;
  await login();
});

test('initialization persists owner, exact amount and stable reference before the provider redirect; retries reuse it',async()=>{
  const first=await initialize(),again=await initialize(10,buyer,first.requestId);
  assert.equal(first.response.status,200);assert.equal(again.result.txRef,first.result.txRef);assert.equal(initializeCalls,1);
  assert.equal(initializedReturnUrl,'https://serkle-app-five.vercel.app/verify');
  const intent=await store.get(first.result.txRef);
  assert.equal(intent?.user_id,buyer);assert.equal(intent?.amount,10);assert.equal(intent?.status,'pending');
  assert.equal(await balance(),0);assert.equal(await access(),false);
  const changed=await initialize(20,buyer,first.requestId);assert.equal(changed.response.status,503);
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
  assert.ok(responses.every(response=>response.status===200));assert.equal(await balance(),20);
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
  assert.equal((await response.json()).status,'test_verified');assert.equal(await balance(),0);assert.equal(await access(),false);
  assert.equal((await handlers().webhook(event(result.txRef,'success',undefined,{mode:'test'}))).status,409);
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

test('service-side withdrawal validation also rejects negative funding and cannot mint premium value',async()=>{
  await service();await assert.rejects(q("SELECT request_withdrawal($1,-10,'chapa_bank_transfer')",[buyer]),/Invalid withdrawal/);
  assert.equal(await balance(),0);assert.equal(await access(),false);
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
