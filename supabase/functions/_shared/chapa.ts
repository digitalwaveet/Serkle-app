import { chapaJson, chapaCorsHeaders } from './chapaHttp.ts';

export type ChapaStatus = 'pending' | 'failed' | 'succeeded' | 'refunded' | 'reversed';
export interface ChapaIntent {
  id: string; user_id: string; tx_ref: string; amount: number; currency: string;
  mode: 'live' | 'test'; status: ChapaStatus; checkout_url?: string | null;
  credited_at?: string | null; reversed_at?: string | null; provider_reference?: string | null;
}
export class PaymentError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
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
  if (envelope?.status!=='success' || !data || data.tx_ref!==intent.tx_ref || wholeBirr(data.amount)!==intent.amount
    || data.currency!==intent.currency || data.mode!==intent.mode || typeof data.reference!=='string' || !data.reference) {
    throw new PaymentError('Provider verification did not match the stored payment',502);
  }
  const statuses: Record<string,ChapaStatus> = {success:'succeeded',pending:'pending',processing:'pending',failed:'failed',cancelled:'failed',canceled:'failed',refunded:'refunded',reversed:'reversed'};
  const status=statuses[data.status];
  const updated=typeof data.updated_at==='string' && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(data.updated_at) ? Date.parse(data.updated_at) : NaN;
  if (!status || !Number.isFinite(updated) || updated>now+300000) throw new PaymentError('Unrecognized provider state or timestamp; reconciliation required',502);
  return { _tx_ref:intent.tx_ref,_status:status,_amount:intent.amount,_currency:intent.currency,
    _mode:intent.mode,_provider_reference:data.reference,_provider_updated_at:new Date(updated).toISOString() };
}
export function paymentResult(intent: ChapaIntent) {
  const credited=!!intent.credited_at && !intent.reversed_at && intent.status==='succeeded' && intent.mode==='live';
  return {success:credited,status:intent.mode==='test' && intent.status==='succeeded' ? 'test_verified' : credited ? 'success' : intent.status,
    verified:!!intent.credited_at || !!intent.reversed_at,userId:intent.user_id,txRef:intent.tx_ref,amount:intent.amount,
    message:credited ? 'Payment verified and wallet credited.' : intent.mode==='test' ? 'Test payment recorded; no spendable coins were added.' : intent.status==='pending' ? 'Payment is pending verification. Do not pay again.' : 'No wallet credit is available for this payment.'};
}

export interface ChapaStore {
  begin(userId: string, requestId: string, amount: number, mode: string): Promise<ChapaIntent>;
  get(txRef: string): Promise<ChapaIntent | null>;
  setCheckout(txRef: string, url: string): Promise<void>;
  apply(evidence: ReturnType<typeof normalizeVerification>): Promise<ChapaIntent>;
  due(userId?: string): Promise<ChapaIntent[]>;
  error(txRef: string, message: string): Promise<void>;
  delivery(hash: string, txRef: string, mode: string): Promise<boolean>;
  finishDelivery(hash: string): Promise<void>;
  reconcileGrants(userId: string): Promise<void>;
}
export interface ChapaDependencies {
  store: ChapaStore;
  authenticate(request: Request): Promise<{id: string; email?: string; phone?: string; user_metadata?: any}>;
  verify(intent: ChapaIntent): Promise<any>;
  initialize(payload: Record<string,unknown>): Promise<string>;
  mode: 'live' | 'test';
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
  const reconcile=async(intent:ChapaIntent)=>{
    if(intent.mode!==deps.mode) throw new PaymentError('Payment environment mismatch',409);
    try {
      const evidence=normalizeVerification(await deps.verify(intent),intent);
      return await deps.store.apply(evidence);
    } catch(error) {
      await deps.store.error(intent.tx_ref,error instanceof Error ? error.message : 'Verification unavailable');
      throw error;
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
      const phone=typeof body.phoneNumber==='string' ? body.phoneNumber.replace(/^\+?251/,'0') : user.phone?.replace(/^\+?251/,'0');
      const url=checkoutUrl(await deps.initialize({amount:String(intent.amount),currency:intent.currency,email,
        tx_ref:intent.tx_ref,return_url:returnUrl,first_name:body.firstName || 'Serkle',last_name:body.lastName || 'User',
        ...(phone && /^0[79]\d{8}$/.test(phone) ? {phone_number:phone} : {}),
        customization:{title:'Serkle Wallet',description:`Top up ${intent.amount} ETB`}}));
      await deps.store.setCheckout(intent.tx_ref,url);
      return json({success:true,userId:intent.user_id,txRef:intent.tx_ref,checkoutUrl:url});
    }),
    verify:safe(async req=>{
      const user=await deps.authenticate(req),body=await req.json();
      if(typeof body.txRef!=='string') throw new PaymentError('Payment reference required');
      const intent=await deps.store.get(body.txRef);
      if(!intent || intent.user_id!==user.id) throw new PaymentError('Payment not found for this account',404);
      const result=await reconcile(intent);
      await deps.store.reconcileGrants(user.id);
      return json(paymentResult(result));
    }),
    webhook:safe(async req=>{
      const raw=new Uint8Array(await req.arrayBuffer());
      if(raw.length>131072) throw new PaymentError('Webhook body too large',413);
      if(!await verifyWebhookSignature(raw,req.headers,deps.webhookSecret)) throw new PaymentError('Invalid webhook signature',401);
      const event=JSON.parse(new TextDecoder().decode(raw));
      if(event.mode!==deps.mode) throw new PaymentError('Webhook environment mismatch',409);
      // Payouts and unrecognized event types must never become wallet credits.
      if(event.type==='Payout' || !/^charge\.(success|failed|cancelled|refunded|reversed|pending|refunding)$/.test(event.event||'')) return json({received:true,ignored:true});
      const hash=await bodyHash(raw);
      const intent=typeof event.tx_ref==='string' ? await deps.store.get(event.tx_ref) : null;
      if(!intent) {
        if(typeof event.tx_ref==='string') await deps.store.delivery(hash,event.tx_ref,deps.mode);
        return json({received:true,requires_review:true});
      }
      if(await deps.store.delivery(hash,intent.tx_ref,deps.mode)) return json({received:true,replayed:true});
      const result=await reconcile(intent); // Never fulfill from event.status.
      if(event.event==='charge.success' && ['pending','failed'].includes(result.status)) {
        await deps.store.error(intent.tx_ref,'Provider has not confirmed the notified success yet');
        throw new PaymentError('Payment reconciliation pending',503);
      }
      if((event.event==='charge.refunded' && result.status!=='refunded' && result.status!=='reversed')
        || (event.event==='charge.reversed' && result.status!=='reversed' && result.status!=='refunded')) {
        await deps.store.error(intent.tx_ref,'Provider has not confirmed the notified reversal yet');
        throw new PaymentError('Refund reconciliation pending',503);
      }
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
      const intents=await deps.store.due(userId);
      const users=new Set(userId ? [userId] : []);
      const results:unknown[]=new Array(intents.length);
      let next=0;
      await Promise.all(Array.from({length:Math.min(4,intents.length)},async()=>{
        while(next<intents.length) {
          const index=next++,intent=intents[index];
          try {const result=await reconcile(intent);users.add(result.user_id);results[index]=paymentResult(result);}
          catch {results[index]={txRef:intent.tx_ref,status:'pending',verified:false};}
        }
      }));
      for(const user of users) await deps.store.reconcileGrants(user);
      return json({success:true,results});
    }),
  };
}
