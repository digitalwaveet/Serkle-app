import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { createChapaHandlers, PaymentError, type ChapaIntent, type ChapaStore, type ChapaDependencies } from './chapa.ts';
import { chapaCorsHeaders, chapaJson, createChapaHttpHandler, type ChapaRoute } from './chapaHttp.ts';
import { createChapaTransferHandler } from './chapaTransfer.ts';
import { createChapaAdminHandler, type ChapaAdminControl } from './chapaAdmin.ts';
import { chapaConfiguration, isChapaMode, type ChapaMode } from './chapaConfiguration.ts';

export async function paymentDependencies(requireAdminSettings = false): Promise<ChapaDependencies & ChapaAdminControl> {
  const { keys, defaultMode, availableModes } = chapaConfiguration((name) => Deno.env.get(name));
  const origins=(Deno.env.get('PAYMENT_RETURN_ORIGINS') || '').split(',').map(value=>value.trim()).filter(Boolean);
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const { data: savedMode, error: modeError } = await client.rpc('get_chapa_mode_override');
  if (modeError && (requireAdminSettings || modeError.code !== 'PGRST202')) throw new Error('Payment mode configuration unavailable');
  if (savedMode != null && !isChapaMode(savedMode)) throw new Error('Invalid payment mode configuration');
  const modeOverride: ChapaMode | null = savedMode ?? null;
  const mode = modeOverride ?? defaultMode;
  const checked=async(request:PromiseLike<any>)=>{const {data,error}=await request;if(error) {
    if(error.message==='Withdrawal verification mismatch') throw new PaymentError('Provider withdrawal details did not match the saved destination. This receipt needs review.',502,'verification_mismatch');
    throw new Error(error.message);
  }return data;};
  const store:ChapaStore={
    begin:async(userId,requestId,amount,mode)=>checked(client.rpc('begin_chapa_payment',{_user_id:userId,_request_id:requestId,_amount:amount,_mode:mode})),
    get:async txRef=>checked(client.from('chapa_payment_intents').select('*').eq('tx_ref',txRef).maybeSingle()),
    beginWithdrawal:async(userId,requestId,amount,mode,fingerprint,destinationHash,bank,hint)=>checked(client.rpc('begin_wallet_withdrawal',{
      _user_id:userId,_request_id:requestId,_amount:amount,_mode:mode,_fingerprint:fingerprint,_destination_hash:destinationHash,_bank_code:bank,_destination_hint:hint})),
    claimWithdrawalSubmit:async ref=>checked(client.rpc('claim_wallet_withdrawal_submit',{_tx_ref:ref})),
    withdrawalSubmitted:async ref=>{await checked(client.rpc('record_wallet_withdrawal_submission',{_tx_ref:ref}));},
    recoverUnsentWithdrawal:async(ref,source)=>checked(client.rpc('recover_unsent_withdrawal',{_tx_ref:ref,_source:source})),
    claimCheckout:async txRef=>checked(client.rpc('claim_chapa_checkout',{_tx_ref:txRef})),
    setCheckout:async(txRef,url)=>{await checked(client.rpc('save_chapa_checkout',{_tx_ref:txRef,_url:url}));},
    claimCheck:async(txRef,source)=>checked(client.rpc('claim_chapa_check',{_tx_ref:txRef,_source:source})),
    apply:async(evidence,details,source)=>checked(client.rpc('record_chapa_check',{_evidence:evidence,_details:details,_source:source})),
    due:async userId=>checked(client.rpc('due_wallet_payments',{_modes:availableModes,_user_id:userId || null,_limit:userId ? 5 : 25})),
    recent:async(userId,since)=>checked(client.from('chapa_payment_intents').select('*').eq('user_id',userId).in('mode',availableModes).eq('kind','topup')
      .gte('created_at',since).order('created_at',{ascending:false}).limit(10)),
    error:async(txRef,message,context)=>{await checked(client.rpc('record_chapa_error',{_tx_ref:txRef,_message:message,
      _stage:context.stage,_code:context.code,_source:context.source,_provider_status:context.providerStatus || null}));},
    beginRun:async mode=>{const row=await checked(client.from('wallet_reconciliation_runs').insert({mode}).select('id').single());return row.id;},
    finishRun:async(id,checkedCount,errors)=>{await checked(client.from('wallet_reconciliation_runs').update({completed_at:new Date().toISOString(),checked:checkedCount,errors}).eq('id',id));},
    delivery:async(hash,txRef,mode)=>{
      await checked(client.from('chapa_webhook_deliveries').upsert({body_hash:hash,tx_ref:txRef,mode},{onConflict:'body_hash',ignoreDuplicates:true}));
      const row=await checked(client.from('chapa_webhook_deliveries').select('processed_at').eq('body_hash',hash).single());
      return !!row.processed_at;
    },
    finishDelivery:async hash=>{await checked(client.from('chapa_webhook_deliveries').update({processed_at:new Date().toISOString()}).eq('body_hash',hash));},
    reconcileGrants:async userId=>{await checked(client.rpc('reconcile_circle_receipts',{_user_id:userId}));},
  };
  const provider=async(path:string,body?:Record<string,unknown>,environment:'live'|'test'=mode as 'live'|'test')=>{
    const key=keys[environment];
    if(!key) throw new PaymentError(`The ${environment} payment environment is unavailable. This receipt remains recorded for later verification.`,409,'environment_unavailable');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(`https://api.chapa.co/v1/${path}`,{method:body ? 'POST' : 'GET',signal:controller.signal,
        headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)} : {})});
      if(!response.ok) {
        if (response.status === 404 && path.startsWith('transaction/verify/')) {
          const result = await response.json().catch(() => null);
          if (typeof result?.message === 'string' && /^payment not paid yet[.!]?$/i.test(result.message.trim())) {
            throw new PaymentError('Chapa reports this payment as unpaid so far. Check this receipt again before retrying.', 409, 'provider_not_paid');
          }
        }
        throw new PaymentError('Chapa could not confirm this request. Check its receipt before trying another payment.',502,'provider_unavailable');
      }
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw new PaymentError('The request to Chapa timed out. The payment outcome is still unconfirmed.', 504, 'provider_timeout');
      throw error;
    }finally{clearTimeout(timer);}
  };
  return {store,mode,modeOverride,availableModes,origins,
    isSuperAdmin: async (actor) => checked(client.rpc('has_role', { _user_id: actor, _role: 'super_admin' })),
    verifyMode: async (candidate) => {
      try {
        const result = await provider('banks', undefined, candidate);
        if (!Array.isArray(result?.data)) throw new Error('Invalid bank list');
      } catch {
        throw new PaymentError('Chapa could not validate the key for this mode. The active mode was not changed.',502);
      }
    },
    setMode: async (actor, next, expected) => {
      const { error } = await client.rpc('set_chapa_mode_override', { _actor: actor, _mode: next, _expected: expected });
      if (error?.code === '55000') throw new PaymentError('Payment mode changed. Refresh before trying again.',409);
      if (error) throw new Error('Payment mode could not be saved');
    },
    auditWithdrawalCheck: async (actor, reference) => {
      await checked(client.rpc('audit_admin_withdrawal_check', { _actor: actor, _reference: reference }));
    },
    auditPaymentCheck: async (actor, reference) => {
      await checked(client.rpc('audit_admin_payment_check', { _actor: actor, _reference: reference }));
    },
    webhookSecret:Deno.env.get('CHAPA_WEBHOOK_SECRET') || '',reconcileSecret:Deno.env.get('CHAPA_RECONCILE_SECRET') || '',
    authenticate:async req=>{
      const match=/^Bearer (.+)$/i.exec(req.headers.get('authorization') || '');
      if(!match) throw new PaymentError('Authentication required',401);
      const {data,error}=await client.auth.getUser(match[1]);
      if(error || !data.user) throw new PaymentError('Authentication required',401);
      return data.user;
    },
    verify:async(intent:ChapaIntent)=>provider(`${intent.kind==='withdrawal' ? 'transfers' : 'transaction'}/verify/${encodeURIComponent(intent.tx_ref)}`,undefined,intent.mode),
    banks:async()=>{const result:any=await provider('banks');if(!Array.isArray(result.data)) throw new PaymentError('Bank list is temporarily unavailable',502);return result.data;},
    initializeWithdrawal:async payload=>provider('transfers',payload),
    initialize:async payload=>{
      const result=await provider('transaction/initialize',payload);
      if(result.status!=='success' || !result.data?.checkout_url) throw new PaymentError('Checkout could not be confirmed. Retry the same request.',502);
      return result.data.checkout_url;
    },
  };
}
export function serveChapa(route:ChapaRoute) {
  serve(createChapaHttpHandler(route, async () => createChapaHandlers(await paymentDependencies())));
}
export function serveChapaTransfer() {
  serve(async request=>{
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:chapaCorsHeaders});
    try {return await createChapaTransferHandler(await paymentDependencies())(request);}
    catch {return chapaJson({success:false,error:'Payment service is not configured. Check the Supabase payment secrets.'},503);}
  });
}

export function serveChapaAdmin() {
  serve(async (request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: chapaCorsHeaders });
    if (request.method !== 'POST') return chapaJson({ error: 'Method not allowed' }, 405);
    if (!request.headers.has('authorization')) return chapaJson({ error: 'Authentication required' }, 401);
    try {
      const runtime = await paymentDependencies(true);
      return await createChapaAdminHandler(runtime, runtime)(request);
    } catch {
      return chapaJson({ error: 'Payment administration is unavailable.' }, 503);
    }
  });
}
