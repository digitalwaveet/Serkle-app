const scenario = localStorage.getItem('chapa-return-fixture') || 'test';
const userId = '00000000-0000-0000-0000-000000000001';
const reference = 'serkle-return-fixture';
export const fixture = {
  user: scenario === 'login' ? null : { id: userId, name:'Fixture Buyer', email:'fixture@example.test' },
  calls: [] as Array<Record<string, unknown>>,
  balance: 0,
  payouts: [] as Array<Record<string, unknown>>,
  checkouts: [] as Array<Record<string, unknown>>,
  rpcs: [] as Array<{ name: string; args: any }>,
  modeChanged: false,
};
(window as any).chapaReturnFixture = fixture;

const historyPayments:any[] = Array.from({length:26},(_,index)=>({
  id:`00000000-0000-0000-0000-${String(index+100).padStart(12,'0')}`,tx_ref:`history-payment-${index}`,kind:'topup',
  amount:index===0 ? 500 : index===1 ? 25 : index===2 ? 50 : 100,currency:'ETB',mode:index===0 ? 'test' : 'live',
  status:index===0 ? 'succeeded' : index===2 ? 'failed' : 'pending',checkout_state:'ready',
  created_at:`2026-11-05T10:${String(59-index).padStart(2,'0')}:00Z`,verified_at:index<3 ? '2026-11-05T11:00:00Z' : null,
  next_check_at:'2026-11-05T11:01:00Z',credited_at:null,reversed_at:null,reserved_at:null,restored_at:null,submitted_at:null,
  check_count:2,last_error:index===3 ? 'Provider details need review.' : null,last_error_code:index===3 ? 'verification_mismatch' : null,
  review_required:index===3,provider_reference:index===0 ? 'fixture-provider-receipt' : null,
  provider_status:index===0 ? 'succeeded' : index===2 ? 'failed' : 'pending',payment_method:index===0 ? 'telebirr' : null,provider_fee:index===0 ? 12.5 : null,
}));
const historyLedger:any[] = Array.from({length:61},(_,index)=>({id:`ledger-${String(index).padStart(3,'0')}`,user_id:userId,amount:1,type:'topup',reference_id:null,description:`Recorded movement ${index+1}`,balance_after:61-index,created_at:`2026-11-04T10:${String(59-Math.floor(index/2)).padStart(2,'0')}:00Z`}));
if(scenario.startsWith('history')) fixture.balance=61;
const historyEvents = (payment:any) => Array.from({length:26},(_,index)=>({id:`event-${String(26-index).padStart(3,'0')}`,payment_id:payment.id,
  event_type:index===0 ? 'verified' : 'check_started',source:'user',status:payment.status,previous_status:'pending',message:null,details:{},created_at:'2026-11-05T11:00:00Z'}));
const slicePage=(rows:any[],args:any) => { const start=args._before_id ? rows.findIndex(row=>row.id===args._before_id)+1 : 0;return rows.slice(start,start+Number(args._limit || 20)+1); };

function result(txRef: string, status: string, amount = 500) {
  const live = status === 'success';
  if (live) fixture.balance = amount;
  return { userId, txRef, amount, status, success: live, verified: live,
    message: status === 'test_verified' ? 'Test payment recorded; no spendable coins were added.' : 'Payment status checked.' };
}

export const supabase = {
  functions: { invoke: async (name: string, options: { body?: Record<string, unknown> }) => {
    if(name==='chapa-initialize' && scenario==='topup-unconfirmed') {
      fixture.checkouts.push(options.body || {});
      return {data:{userId,txRef:'saved-checkout-fixture',amount:50,mode:'test',status:'pending',success:false,verified:false,message:'Checkout could not be confirmed. Your payment reference is recorded; check its status before trying another payment.'},error:null};
    }
    if(name==='chapa-transfer?action=configuration') {
      if(scenario==='mode-change') fixture.modeChanged=true;
      return {data:{success:true,userId,mode:fixture.modeChanged ? 'live' : 'test'},error:null};
    }
    if (name === 'chapa-transfer' && !options.body) return { data: { success: true,userId,mode:fixture.modeChanged ? 'live' : 'test', banks: [{id:855,name:'Fixture Bank',acct_length:10}] }, error: null };
    if(name==='chapa-transfer') {
      fixture.payouts.push(options.body || {});
      return {data:{success:false,status:'pending',kind:'withdrawal',mode:'test',userId,requestId:options.body?.requestId,txRef:'withdrawal-fixture',message:'Test withdrawal recorded. No spendable coins were removed.'},error:null};
    }
    if (name !== 'chapa-verify') throw new Error('The return page must never initialize or charge a payment');
    const body = options.body || {};
    fixture.calls.push(body);
    await new Promise(resolve => setTimeout(resolve, 30));
    let data: any;
    if(scenario.startsWith('history')) {
      const payment=historyPayments.find(payment=>payment.tx_ref===body.txRef);
      if(!payment) throw new Error('Unknown fixture receipt');
      if(payment.mode==='live' && !payment.credited_at) {
        payment.status='succeeded';payment.provider_status='succeeded';payment.credited_at=new Date().toISOString();fixture.balance+=payment.amount;
        historyLedger.unshift({id:'verified-ledger',user_id:userId,amount:payment.amount,type:'topup',reference_id:payment.id,description:'Verified Chapa top-up',balance_after:fixture.balance,created_at:new Date().toISOString()});
      }
      const live=payment.mode==='live';
      data={userId,txRef:payment.tx_ref,amount:payment.amount,status:live ? 'success' : 'test_verified',success:live,verified:live,mode:payment.mode,message:'Payment status checked.'};
    }
    else if (scenario === 'unknown') data = { userId, status: 'unknown', success: false, verified: false, candidates: [], message: 'No recent payment could be identified. Check your wallet history.' };
    else if (scenario === 'selection' && !body.txRef) data = { userId, status: 'selection_required', success: false, verified: false, candidates: [
      { txRef: 'serkle-first', amount: 10, status: 'pending', createdAt: '2026-11-05T09:00:00Z' },
      { txRef: 'serkle-second', amount: 20, status: 'pending', createdAt: '2026-11-05T09:02:00Z' },
    ] };
    else if (scenario === 'selection') data = result(String(body.txRef), 'success', body.txRef === 'serkle-second' ? 20 : 10);
    else if (scenario === 'pending') data = result(String(body.txRef || reference), fixture.calls.length === 1 ? 'pending' : 'success');
    else if (scenario === 'forged') data = { ...result(String(body.txRef || reference), 'pending'), status: 'success', success: true, verified: false };
    else if (scenario === 'failed') data = result(String(body.txRef || reference), 'failed');
    else data = result(String(body.txRef || reference), 'test_verified');
    return { data, error: null };
  } },
  rpc: async(name:string,args:any) => {
    fixture.rpcs.push({name,args});
    const owner=scenario==='history-wrong-account' ? '00000000-0000-0000-0000-000000000002' : userId;
    if(name==='get_wallet_payment_history') return {data:{userId:owner,items:slicePage(historyPayments.filter(payment=>args._mode==='all' || payment.mode===args._mode),args),automaticChecks:{live:new Date().toISOString(),test:new Date().toISOString()}},error:null};
    if(name==='get_wallet_activity') return {data:{userId:owner,items:slicePage(historyLedger,args),integrity:{status:'balanced',recordedBalance:fixture.balance,expectedBalance:fixture.balance,baselineAt:null}},error:null};
    if(name==='get_wallet_payment_receipt') {
      const payment=historyPayments.find(payment=>payment.id===args._payment_id);
      return {data:{userId:owner,payment,ledger:historyLedger.filter(entry=>entry.reference_id===payment.id),events:slicePage(historyEvents(payment),args)},error:null};
    }
    throw new Error('Unexpected fixture RPC: '+name);
  },
  from: (table: string) => {
    const data = () => table === 'coin-wallets' || table === 'coin_wallets'
      ? { user_id: userId, balance: fixture.balance, total_earned: fixture.balance, total_spent: 0 } : [];
    const query = {
      select: () => query, eq: () => query, order: () => query, limit: () => query,
      maybeSingle: async () => ({ data: data(), error: null }),
      then: (resolve: any, reject: any) => Promise.resolve({ data: data(), error: null }).then(resolve, reject),
    };
    return query;
  },
};
