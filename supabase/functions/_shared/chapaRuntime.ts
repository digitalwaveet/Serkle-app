import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { createChapaHandlers, PaymentError, type ChapaIntent, type ChapaStore, type ChapaDependencies } from './chapa.ts';
import { chapaCorsHeaders, chapaJson, createChapaHttpHandler, type ChapaRoute } from './chapaHttp.ts';
import { createChapaTransferHandler } from './chapaTransfer.ts';

export function paymentDependencies(): ChapaDependencies {
  const secret=Deno.env.get('CHAPA_SECRET_KEY') || '';
  const mode=Deno.env.get('CHAPA_MODE');
  const origins=(Deno.env.get('PAYMENT_RETURN_ORIGINS') || '').split(',').map(value=>value.trim()).filter(Boolean);
  if(!secret || !['live','test'].includes(mode || '')
    || (mode==='live' && secret.includes('_TEST-')) || (mode==='test' && !secret.includes('_TEST-'))) throw new Error('Payment configuration unavailable');
  const keys:Partial<Record<'live'|'test',string>>={[mode!]:secret};
  const live=Deno.env.get('CHAPA_LIVE_SECRET_KEY'),test=Deno.env.get('CHAPA_TEST_SECRET_KEY');
  if(live) {if(live.includes('_TEST-')) throw new Error('Live payment key is invalid');keys.live=live;}
  if(test) {if(!test.includes('_TEST-')) throw new Error('Test payment key is invalid');keys.test=test;}
  const availableModes=Object.keys(keys) as Array<'live'|'test'>;
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
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
    recent:async(userId,since)=>checked(client.from('chapa_payment_intents').select('*').eq('user_id',userId).eq('mode',mode).eq('kind','topup')
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
      if(!response.ok) throw new PaymentError('Chapa could not confirm this request. Check its receipt before trying another payment.',502,'provider_unavailable');
      return response.json();
    }finally{clearTimeout(timer);}
  };
  return {store,mode:mode as 'live'|'test',availableModes,origins,
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
  serve(createChapaHttpHandler(route,()=>createChapaHandlers(paymentDependencies())));
}
export function serveChapaTransfer() {
  serve(async request=>{
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:chapaCorsHeaders});
    try {return await createChapaTransferHandler(paymentDependencies())(request);}
    catch {return chapaJson({success:false,error:'Payment service is not configured. Check the Supabase payment secrets.'},503);}
  });
}
