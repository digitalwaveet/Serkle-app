import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { createChapaHandlers, PaymentError, type ChapaIntent, type ChapaStore } from './chapa.ts';

function runtime() {
  const secret=Deno.env.get('CHAPA_SECRET_KEY') || '';
  const mode=Deno.env.get('CHAPA_MODE');
  const origins=(Deno.env.get('PAYMENT_RETURN_ORIGINS') || '').split(',').map(value=>value.trim()).filter(Boolean);
  if(!secret || !['live','test'].includes(mode || '') || !origins.length
    || (mode==='live' && secret.includes('_TEST-')) || (mode==='test' && !secret.includes('_TEST-'))) throw new Error('Payment configuration unavailable');
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const checked=async(request:PromiseLike<any>)=>{const {data,error}=await request;if(error) throw new Error(error.message);return data;};
  const store:ChapaStore={
    begin:async(userId,requestId,amount,mode)=>checked(client.rpc('begin_chapa_payment',{_user_id:userId,_request_id:requestId,_amount:amount,_mode:mode})),
    get:async txRef=>checked(client.from('chapa_payment_intents').select('*').eq('tx_ref',txRef).maybeSingle()),
    setCheckout:async(txRef,url)=>{await checked(client.from('chapa_payment_intents').update({checkout_url:url}).eq('tx_ref',txRef).eq('status','pending'));},
    apply:async evidence=>checked(client.rpc('apply_chapa_verification',evidence)),
    due:async userId=>{
      let query=client.from('chapa_payment_intents').select('*').eq('mode',mode).lte('next_check_at',new Date().toISOString()).is('reversed_at',null).order('next_check_at').limit(userId ? 5 : 25);
      if(userId) query=query.eq('user_id',userId);
      return checked(query);
    },
    error:async(txRef,message)=>{await checked(client.from('chapa_payment_intents').update({last_error:message.slice(0,250),next_check_at:new Date(Date.now()+60000).toISOString()}).eq('tx_ref',txRef));},
    delivery:async(hash,txRef,mode)=>{
      await checked(client.from('chapa_webhook_deliveries').upsert({body_hash:hash,tx_ref:txRef,mode},{onConflict:'body_hash',ignoreDuplicates:true}));
      const row=await checked(client.from('chapa_webhook_deliveries').select('processed_at').eq('body_hash',hash).single());
      return !!row.processed_at;
    },
    finishDelivery:async hash=>{await checked(client.from('chapa_webhook_deliveries').update({processed_at:new Date().toISOString()}).eq('body_hash',hash));},
    reconcileGrants:async userId=>{await checked(client.rpc('reconcile_circle_receipts',{_user_id:userId}));},
  };
  const provider=async(path:string,body?:Record<string,unknown>)=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(`https://api.chapa.co/v1/${path}`,{method:body ? 'POST' : 'GET',signal:controller.signal,
        headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)} : {})});
      if(!response.ok) throw new PaymentError('Chapa verification is temporarily unavailable. Reconcile before paying again.',502);
      return response.json();
    }finally{clearTimeout(timer);}
  };
  return createChapaHandlers({store,mode:mode as 'live'|'test',origins,
    webhookSecret:Deno.env.get('CHAPA_WEBHOOK_SECRET') || '',reconcileSecret:Deno.env.get('CHAPA_RECONCILE_SECRET') || '',
    authenticate:async req=>{
      const match=/^Bearer (.+)$/i.exec(req.headers.get('authorization') || '');
      if(!match) throw new PaymentError('Authentication required',401);
      const {data,error}=await client.auth.getUser(match[1]);
      if(error || !data.user) throw new PaymentError('Authentication required',401);
      return data.user;
    },
    verify:async(intent:ChapaIntent)=>provider(`transaction/verify/${encodeURIComponent(intent.tx_ref)}`),
    initialize:async payload=>{
      const result=await provider('transaction/initialize',payload);
      if(result.status!=='success' || !result.data?.checkout_url) throw new PaymentError('Checkout could not be confirmed. Retry the same request.',502);
      return result.data.checkout_url;
    },
  });
}
export function serveChapa(route:keyof ReturnType<typeof createChapaHandlers>) {
  serve(async request=>{
    try{return await runtime()[route](request);}catch{return new Response(JSON.stringify({success:false,error:'Payment service is not configured'}),{status:503,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});}
  });
}
