import { bodyHash, createChapaHandlers, PaymentError, paymentResult, wholeBirr, type ChapaDependencies } from './chapa.ts';
import { chapaCorsHeaders, chapaJson } from './chapaHttp.ts';

export function createChapaTransferHandler(deps: ChapaDependencies) {
  return async (request: Request) => {
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers:chapaCorsHeaders});
    if (!['GET','POST'].includes(request.method)) return chapaJson({success:false,error:'Method not allowed'},405);
    try {
      const user=await deps.authenticate(request);
      if (request.method==='GET') {
        if (new URL(request.url).searchParams.get('action')==='configuration') return chapaJson({success:true,userId:user.id,mode:deps.mode});
        return chapaJson({success:true,userId:user.id,mode:deps.mode,banks:await deps.banks()});
      }
      const body=await request.clone().json();
      if (body.action==='verify') return createChapaHandlers(deps).verify(request);
      if (body.expectedMode!==deps.mode) throw new PaymentError('Payment mode changed or is unknown. Refresh the wallet and review the withdrawal mode before confirming.',409);
      if (typeof body.requestId!=='string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.requestId)) throw new PaymentError('Withdrawal request ID required');
      const amount=wholeBirr(body.amount),bank=Number(body.bankCode);
      const account=typeof body.accountNumber==='string' ? body.accountNumber.trim() : '';
      const name=typeof body.accountName==='string' ? body.accountName.normalize('NFKC').trim() : '';
      if (!Number.isSafeInteger(bank) || bank<=0 || !/^\d{6,30}$/.test(account) || !name || name.length>100) throw new PaymentError('A valid bank, account number and account name are required');
      const banks=await deps.banks(),selected=banks.find(item=>Number(item.id)===bank);
      if (!selected) throw new PaymentError('The selected bank is not supported');
      const encode=new TextEncoder();
      const fingerprint=await bodyHash(encode.encode(JSON.stringify([user.id,amount,deps.mode,bank,account,name])));
      const destinationHash=await bodyHash(encode.encode(`${bank}:${account}`));
      const hint=`${String(selected.name).slice(0,80)} ••••${account.slice(-4)}`;
      const intent=await deps.store.beginWithdrawal(user.id,body.requestId,amount,deps.mode,fingerprint,destinationHash,bank,hint);
      if (intent.status!=='pending' || intent.submitted_at) return chapaJson(paymentResult(intent));
      if (!await deps.store.claimWithdrawalSubmit(intent.tx_ref)) return chapaJson(paymentResult(await deps.store.get(intent.tx_ref) || intent),202);
      try {
        const response:any=await deps.initializeWithdrawal({account_name:name,account_number:account,amount:String(amount),currency:'ETB',reference:intent.tx_ref,bank_code:bank,
          ...(deps.mode==='test' ? {status:'success'} : {})});
        if (response?.status!=='success') throw new Error('Payout request was not confirmed');
        await deps.store.withdrawalSubmitted(intent.tx_ref);
      } catch {
        await deps.store.error(intent.tx_ref,'The payout request could not be confirmed. Its reference is saved; it will be checked without sending another payout.',
          {stage:'checkout',code:'withdrawal_submission_uncertain',source:'initialize'});
      }
      return chapaJson(paymentResult(await deps.store.get(intent.tx_ref) || intent),202);
    } catch (error) {
      return chapaJson({success:false,error:error instanceof PaymentError ? error.message : 'Withdrawal could not be confirmed. Check your saved receipts before trying another request.'},error instanceof PaymentError ? error.status : 503);
    }
  };
}
