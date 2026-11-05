import { chapaJson, chapaCorsHeaders } from './chapaHttp.ts';

export type ChapaStatus = 'pending' | 'failed' | 'succeeded' | 'refunded' | 'reversed';
export interface ChapaIntent {
  id: string; user_id: string; tx_ref: string; amount: number; currency: string;
  mode: 'live' | 'test'; status: ChapaStatus; checkout_url?: string | null;
  credited_at?: string | null; reversed_at?: string | null; provider_reference?: string | null;
  created_at?: string;
  verified_at?: string | null; next_check_at?: string; review_required?: boolean;
  provider_status?: string | null;
  kind?: 'topup' | 'withdrawal'; reserved_at?: string | null; restored_at?: string | null; submitted_at?: string | null;
  request_id?: string;
}
export class PaymentError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'payment_error') { super(message); this.status = status; this.code = code; }
}
export type PaymentSource = 'user' | 'webhook' | 'scheduled' | 'reconcile';
export interface PaymentFailure { stage: 'checkout' | 'verification' | 'fulfillment'; code: string; source: PaymentSource | 'initialize'; providerStatus?: string }
export function providerDetails(envelope: any) {
  const data=envelope?.data;
  const feeValue=typeof data?.charge==='string' ? data.charge.trim() : data?.charge;
  const fee=(typeof feeValue==='number' || (typeof feeValue==='string' && /^\d+(?:\.\d+)?$/.test(feeValue))) ? Number(feeValue) : NaN;
  return {paymentMethod:typeof data?.payment_method==='string' ? data.payment_method.slice(0,80) : typeof data?.bank_name==='string' ? data.bank_name.slice(0,80) : null,
    fee:Number.isFinite(fee) && fee>=0 && fee<=1000000000 ? fee.toFixed(2) : null};
}
const encoder = new TextEncoder();
export async function verifyWebhookSignature(raw: Uint8Array, headers: Headers, secret: string) {
  if (!secret) return false;
  // Payload-bound signatures only. The v1 legacy HMAC(secret,secret) header
  // cannot authenticate the payload and is intentionally not accepted.
  const signature = headers.get('x-chapa-signature') || headers.get('chapa-signature') || '';
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const bytes = Uint8Array.from(signature.match(/../g)!,value=>parseInt(value,16));
  return crypto.subtle.verify('HMAC',key,bytes,raw);
}
export async function bodyHash(raw: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),value=>value.toString(16).padStart(2,'0')).join('');
}
export function wholeBirr(value: unknown) {
  if ((typeof value!=='string' && typeof value!=='number') || !/^\d+(?:\.0{1,2})?$/.test(String(value))) throw new PaymentError('Invalid payment amount');
  const amount=Number(value);
  if (!Number.isSafeInteger(amount) || amount<10 || amount>1000000) throw new PaymentError('Payment amount must be 10–1,000,000 whole ETB');
  return amount;
}
export function checkoutUrl(value: unknown) {
  const url=new URL(String(value));
  if (url.protocol!=='https:' || url.username || url.password || !(url.hostname==='checkout.chapa.co' || url.hostname.endsWith('.chapa.co'))) throw new PaymentError('Invalid provider checkout URL',502);
  return url.href;
}
export function allowedReturnUrl(value: unknown, origins: string[]) {
  const target=new URL(typeof value==='string' ? value : `${origins[0]}/verify`);
  if (!origins.includes(target.origin) || target.pathname!=='/verify' || target.username || target.password) throw new PaymentError('Invalid payment return URL');
  target.search=''; target.hash='';
  return target.href;
}
export function normalizeVerification(envelope: any, intent: ChapaIntent, now = Date.now()) {
  const data=envelope?.data;
  let amount: number;
  try { amount=wholeBirr(data?.amount); } catch { throw new PaymentError('Provider amount did not match the stored payment. This receipt needs review.',502,'verification_mismatch'); }
  if (envelope?.status!=='success' || !data || data.tx_ref!==intent.tx_ref || amount!==intent.amount
    || data.currency!==intent.currency || data.mode!==intent.mode || typeof data.reference!=='string' || !data.reference) {
    throw new PaymentError('Provider verification did not match the stored payment. This receipt needs review.',502,'verification_mismatch');
  }
  const statuses: Record<string,ChapaStatus> = {success:'succeeded',pending:'pending',processing:'pending',failed:'failed',cancelled:'failed',canceled:'failed',refunded:'refunded',reversed:'reversed'};
  const status=statuses[data.status];
  const updated=typeof data.updated_at==='string' && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(data.updated_at) ? Date.parse(data.updated_at) : NaN;
  if (!status || !Number.isFinite(updated) || updated>now+300000) throw new PaymentError('Unrecognized provider state or timestamp; reconciliation required',502,'provider_state_unknown');
  return { _tx_ref:intent.tx_ref,_status:status,_amount:intent.amount,_currency:intent.currency,
    _mode:intent.mode,_provider_reference:data.reference,_provider_updated_at:new Date(updated).toISOString() };
}
export async function normalizeWithdrawalVerification(envelope: any, intent: ChapaIntent) {
  const data=envelope?.data;
  const bank=Number(data?.bank_id ?? data?.bank_code ?? data?.bank?.id);
  if (!Number.isSafeInteger(bank) || bank<=0 || typeof data?.account_number!=='string' || !/^\d{6,30}$/.test(data.account_number)) {
    throw new PaymentError('Provider destination details are incomplete. This withdrawal needs review.',502,'verification_mismatch');
  }
  const status=data.status==='queued' || data.status==='pending_approval' ? 'pending' : data.status==='reverted' ? 'reversed' : data.status;
  // Transfer responses can omit mode. The authenticated provider request uses
  // the validated server key for the receipt's environment; an explicit mode
  // must still match. Never infer an environment from a client or webhook.
  const evidence=normalizeVerification({...envelope,data:{...data,status,tx_ref:data.reference,reference:data.chapa_reference,mode:data.mode ?? intent.mode}},intent);
  return {evidence,details:{...providerDetails(envelope),destinationHash:await bodyHash(encoder.encode(`${bank}:${data.account_number}`))}};
}
export function paymentResult(intent: ChapaIntent) {
  if (intent.kind==='withdrawal') {
    const completed=intent.status==='succeeded';
    return {success:completed,status:intent.mode==='test' && completed ? 'test_withdrawal_verified' : completed ? 'withdrawal_completed' : intent.restored_at ? 'withdrawal_restored' : intent.status,
      verified:!!intent.verified_at,userId:intent.user_id,txRef:intent.tx_ref,amount:intent.amount,paymentId:intent.id,kind:'withdrawal',mode:intent.mode,
      checkedAt:intent.verified_at,nextCheckAt:intent.next_check_at,reviewRequired:!!intent.review_required,requestId:intent.request_id,
      fundsReserved:!!intent.reserved_at && !intent.restored_at,fundsRestored:!!intent.restored_at,
      message:intent.mode==='test' ? 'Test withdrawal recorded. No spendable coins were removed.' : intent.restored_at ? intent.submitted_at ? 'Chapa confirmed the withdrawal did not complete. The reserved coins were returned.' : 'No payout was submitted. The reserved coins were returned.'
        : completed ? 'Chapa confirmed the withdrawal completed.' : intent.reserved_at ? 'Withdrawal recorded. Coins are reserved while its status is confirmed. Check this receipt before requesting another withdrawal.' : 'No payout was sent and no coins were removed.'};
  }
  const credited=!!intent.credited_at && !intent.reversed_at && intent.status==='succeeded' && intent.mode==='live';
  return {success:credited,status:intent.mode==='test' && intent.status==='succeeded' ? 'test_verified' : credited ? 'success' : intent.status,
    verified:!!intent.credited_at || !!intent.reversed_at,userId:intent.user_id,txRef:intent.tx_ref,amount:intent.amount,
    paymentId:intent.id,mode:intent.mode,checkedAt:intent.verified_at,nextCheckAt:intent.next_check_at,reviewRequired:!!intent.review_required,
    message:credited ? 'Payment verified and wallet credited.' : intent.mode==='test' && intent.status==='succeeded' ? 'Test payment recorded; no spendable coins were added.'
      : intent.provider_status==='succeeded' && !intent.credited_at ? 'Chapa confirmed the payment; the wallet update is pending. Recheck this receipt before making another payment.'
      : intent.status==='pending' ? 'Payment is pending verification. Check this receipt before paying again.' : 'No wallet credit is available for this payment. If you completed it later, recheck this receipt.'};
}

export interface ChapaStore {
  begin(userId: string, requestId: string, amount: number, mode: string): Promise<ChapaIntent>;
  get(txRef: string): Promise<ChapaIntent | null>;
  beginWithdrawal(userId: string, requestId: string, amount: number, mode: string, fingerprint: string, destinationHash: string, bank: number, hint: string): Promise<ChapaIntent>;
  claimWithdrawalSubmit(txRef: string): Promise<boolean>;
  withdrawalSubmitted(txRef: string): Promise<void>;
  recoverUnsentWithdrawal(txRef: string, source: PaymentSource): Promise<ChapaIntent>;
  claimCheckout(txRef: string): Promise<boolean>;
  setCheckout(txRef: string, url: string): Promise<void>;
  claimCheck(txRef: string, source: PaymentSource): Promise<string>;
  apply(evidence: ReturnType<typeof normalizeVerification>, details: ReturnType<typeof providerDetails> & {destinationHash?: string}, source: PaymentSource): Promise<ChapaIntent>;
  due(userId?: string): Promise<ChapaIntent[]>;
  recent(userId: string, since: string): Promise<ChapaIntent[]>;
  error(txRef: string, message: string, context: PaymentFailure): Promise<void>;
  beginRun(mode: string): Promise<string>;
  finishRun(id: string, checked: number, errors: number): Promise<void>;
  delivery(hash: string, txRef: string, mode: string): Promise<boolean>;
  finishDelivery(hash: string): Promise<void>;
  reconcileGrants(userId: string): Promise<void>;
}
export interface ChapaDependencies {
  store: ChapaStore;
  authenticate(request: Request): Promise<{id: string; email?: string; phone?: string; user_metadata?: any}>;
  verify(intent: ChapaIntent): Promise<any>;
  initialize(payload: Record<string,unknown>): Promise<string>;
  banks(): Promise<any[]>;
  initializeWithdrawal(payload: Record<string,unknown>): Promise<unknown>;
  mode: 'live' | 'test';
  availableModes?: Array<'live' | 'test'>;
  webhookSecret: string;
  reconcileSecret: string;
  origins: string[];
}

export function createChapaHandlers(deps: ChapaDependencies) {
  const json=chapaJson;
  const safe=(action:(req:Request)=>Promise<Response>)=>async(req:Request)=>{
    if(req.method==='OPTIONS') return new Response(null,{status:204,headers:chapaCorsHeaders});
    if(req.method!=='POST') return json({error:'Method not allowed'},405);
    try { return await action(req); } catch(error) {
      return json({success:false,error:error instanceof PaymentError ? error.message : 'Payment could not be verified. Please retry reconciliation.'},error instanceof PaymentError ? error.status : 503);
    }
  };
  const reconcile=async(intent:ChapaIntent,source:PaymentSource)=>{
    if(!(deps.availableModes || [deps.mode]).includes(intent.mode)) throw new PaymentError('Payment environment mismatch. This receipt remains recorded for later verification.',409,'environment_unavailable');
    const claim=await deps.store.claimCheck(intent.tx_ref,source);
    if(claim==='busy') throw new PaymentError('This payment is already being checked. Check its receipt again shortly.',503,'check_in_progress');
    if(claim==='rate_limited') throw new PaymentError('Too many status checks. Wait one minute before checking again.',429,'check_rate_limited');
    if(intent.kind==='withdrawal' && !intent.submitted_at) {
      intent=await deps.store.recoverUnsentWithdrawal(intent.tx_ref,source);
      if(!intent.submitted_at) return intent;
    }
    let evidence:ReturnType<typeof normalizeVerification>|undefined;
    try {
      const response=await deps.verify(intent);
      const normalized=intent.kind==='withdrawal' ? await normalizeWithdrawalVerification(response,intent) : {evidence:normalizeVerification(response,intent),details:providerDetails(response)};
      evidence=normalized.evidence;
      return await deps.store.apply(evidence,normalized.details,source);
    } catch(error) {
      const code=error instanceof PaymentError ? error.code : evidence ? 'fulfillment_error' : 'provider_unavailable';
      const message=error instanceof PaymentError ? error.message : evidence ? 'Payment verification completed, but the wallet update could not finish. A retry is scheduled.'
        : 'The payment provider could not be reached. A retry is scheduled.';
      await deps.store.error(intent.tx_ref,message,{stage:evidence ? 'fulfillment' : 'verification',code,source,providerStatus:evidence?._status});
      throw new PaymentError(message,error instanceof PaymentError ? error.status : 503,code);
    }
  };
  return {
    initialize:safe(async req=>{
      const user=await deps.authenticate(req),body=await req.json();
      if(!deps.origins.length) throw new PaymentError('PAYMENT_RETURN_ORIGINS is not configured for checkout',503);
      if(typeof body.requestId!=='string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.requestId)) throw new PaymentError('Payment request ID required');
      const amount=wholeBirr(body.amount);
      const email=typeof body.email==='string' ? body.email.trim() : user.email;
      if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PaymentError('A valid receipt email is required');
      const returnUrl=allowedReturnUrl(body.returnUrl,deps.origins);
      const intent=await deps.store.begin(user.id,body.requestId,amount,deps.mode);
      if(intent.status!=='pending') return json(paymentResult(intent));
      if(intent.checkout_url) return json({success:true,userId:intent.user_id,txRef:intent.tx_ref,checkoutUrl:intent.checkout_url});
      if(!await deps.store.claimCheckout(intent.tx_ref)) {
        const current=await deps.store.get(intent.tx_ref) || intent;
        if(current.checkout_url) return json({success:true,userId:current.user_id,txRef:current.tx_ref,checkoutUrl:current.checkout_url});
        return json({...paymentResult(current),message:'Checkout is already being prepared. Your payment reference is recorded; check its receipt before retrying.'},202);
      }
      const paymentReturnUrl=new URL(returnUrl);
      paymentReturnUrl.searchParams.set('tx_ref',intent.tx_ref);
      const phone=typeof body.phoneNumber==='string' ? body.phoneNumber.replace(/^\+?251/,'0') : user.phone?.replace(/^\+?251/,'0');
      try {
      const url=checkoutUrl(await deps.initialize({amount:String(intent.amount),currency:intent.currency,email,
        tx_ref:intent.tx_ref,return_url:paymentReturnUrl.href,first_name:body.firstName || 'Serkle',last_name:body.lastName || 'User',
        ...(phone && /^0[79]\d{8}$/.test(phone) ? {phone_number:phone} : {}),
        customization:{title:'Serkle Wallet',description:`Top up ${intent.amount} ETB`}}));
      await deps.store.setCheckout(intent.tx_ref,url);
      return json({success:true,userId:intent.user_id,txRef:intent.tx_ref,checkoutUrl:url});
      } catch(error) {
        const message='Checkout could not be confirmed. Your payment reference is recorded; check its status before trying another payment.';
        await deps.store.error(intent.tx_ref,message,{stage:'checkout',code:'checkout_unconfirmed',source:'initialize'});
        return json({...paymentResult(intent),message},202);
      }
    }),
    verify:safe(async req=>{
      const user=await deps.authenticate(req),body=await req.json();
      let txRef=body.txRef;
      if(txRef===undefined || txRef===null) {
        const recent=(await deps.store.recent(user.id,new Date(Date.now()-86400000).toISOString()))
          .filter(intent=>intent.user_id===user.id && intent.mode===deps.mode && intent.kind!=='withdrawal');
        if(recent.length!==1) return json({success:false,verified:false,userId:user.id,
          status:recent.length ? 'selection_required' : 'unknown',
          message:recent.length ? 'Choose the payment you want to check.' : 'No recent payment could be identified. Check your wallet history or contact support with your Chapa receipt.',
          candidates:recent.map(intent=>({txRef:intent.tx_ref,amount:intent.amount,status:intent.status,createdAt:intent.created_at || null}))});
        txRef=recent[0].tx_ref;
      }
      if(typeof txRef!=='string' || !txRef.trim()) throw new PaymentError('Payment reference required');
      const intent=await deps.store.get(txRef);
      if(!intent || intent.user_id!==user.id) throw new PaymentError('Payment not found for this account',404);
      const result=await reconcile(intent,'user');
      await deps.store.reconcileGrants(user.id);
      return json(paymentResult(result));
    }),
    webhook:safe(async req=>{
      const raw=new Uint8Array(await req.arrayBuffer());
      if(raw.length>131072) throw new PaymentError('Webhook body too large',413);
      if(!await verifyWebhookSignature(raw,req.headers,deps.webhookSecret)) throw new PaymentError('Invalid webhook signature',401);
      const event=JSON.parse(new TextDecoder().decode(raw));
      const payout=event.type==='Payout';
      if(event.mode!==undefined && !(deps.availableModes || [deps.mode]).includes(event.mode)) throw new PaymentError('Webhook environment mismatch',409);
      if(!payout && event.mode===undefined) throw new PaymentError('Webhook environment required',409);
      if(payout ? !/^payout\.(success|failed|cancelled|failed\/cancelled|reversed|pending)$/.test(event.event||'') : !/^charge\.(success|failed|cancelled|refunded|reversed|pending|refunding)$/.test(event.event||'')) return json({received:true,ignored:true});
      const hash=await bodyHash(raw);
      const reference=payout ? event.reference : event.tx_ref;
      const intent=typeof reference==='string' ? await deps.store.get(reference) : null;
      if(!intent) {
        if(typeof reference==='string') await deps.store.delivery(hash,reference,event.mode || deps.mode);
        return json({received:true,requires_review:true});
      }
      if((payout && intent.kind!=='withdrawal') || (!payout && intent.kind==='withdrawal') || (event.mode!==undefined && event.mode!==intent.mode)) throw new PaymentError('Webhook receipt mismatch',409);
      if(await deps.store.delivery(hash,intent.tx_ref,intent.mode)) return json({received:true,replayed:true});
      const result=await reconcile(intent,'webhook'); // Never fulfill from event.status.
      if(['charge.success','payout.success'].includes(event.event) && ['pending','failed'].includes(result.status)) {
        await deps.store.error(intent.tx_ref,'Provider has not confirmed the notified success yet',{stage:'verification',code:'notification_pending',source:'webhook'});
        throw new PaymentError('Payment reconciliation pending',503);
      }
      if((event.event==='charge.refunded' && result.status!=='refunded' && result.status!=='reversed')
        || (event.event==='charge.reversed' && result.status!=='reversed' && result.status!=='refunded')) {
        await deps.store.error(intent.tx_ref,'Provider has not confirmed the notified reversal yet',{stage:'verification',code:'notification_pending',source:'webhook'});
        throw new PaymentError('Refund reconciliation pending',503);
      }
      if(payout && /failed|cancelled|reversed/.test(event.event) && !['failed','reversed'].includes(result.status)) throw new PaymentError('Withdrawal reconciliation is awaiting provider confirmation',503);
      await deps.store.reconcileGrants(result.user_id);
      await deps.store.finishDelivery(hash);
      return json({received:true});
    }),
    reconcile:safe(async req=>{
      const supplied=req.headers.get('x-reconcile-secret');
      let userId:string|undefined;
      if(supplied) {
        // Use constant-time HMAC verification for the scheduler credential too.
        const a=await bodyHash(encoder.encode(supplied)),b=await bodyHash(encoder.encode(deps.reconcileSecret));
        let diff=a.length^b.length;
        for(let i=0;i<a.length;i++) diff|=a.charCodeAt(i)^b.charCodeAt(i);
        if(!deps.reconcileSecret || diff) throw new PaymentError('Unauthorized scheduler',401);
      } else userId=(await deps.authenticate(req)).id;
      const runIds=userId ? [] : await Promise.all((deps.availableModes || [deps.mode]).map(async mode=>({mode,id:await deps.store.beginRun(mode)})));
      const intents=await deps.store.due(userId);
      const users=new Set(userId ? [userId] : []);
      const results:unknown[]=new Array(intents.length);
      let next=0;
      await Promise.all(Array.from({length:Math.min(4,intents.length)},async()=>{
        while(next<intents.length) {
          const index=next++,intent=intents[index];
          try {const result=await reconcile(intent,userId ? 'reconcile' : 'scheduled');users.add(result.user_id);results[index]=paymentResult(result);}
          catch {results[index]={...paymentResult(intent),checkPending:true};}
        }
      }));
      for(const user of users) await deps.store.reconcileGrants(user);
      for(const run of runIds) await deps.store.finishRun(run.id,intents.filter(intent=>intent.mode===run.mode).length,
        results.filter((result:any,index)=>intents[index].mode===run.mode && result.checkPending).length);
      return json({success:true,results});
    }),
  };
}
