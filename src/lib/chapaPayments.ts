// Use the approved app callback even when checkout starts on another host.
export const CHAPA_RETURN_URL = 'https://serkle-app-five.vercel.app/verify';

export interface ChapaRecoveryCandidate {
  txRef: string;
  amount: number;
  status: string;
  createdAt: string | null;
}

export interface VerifiedTopUp {
  status: string;
  success?: boolean;
  verified?: boolean;
  txRef?: string;
  userId?: string;
  amount?: number;
  message?: string;
  candidates?: ChapaRecoveryCandidate[];
  paymentId?: string;
  mode?: 'test' | 'live';
  checkedAt?: string;
  nextCheckAt?: string;
  reviewRequired?: boolean;
  kind?: 'topup' | 'withdrawal'; requestId?: string;
  fundsReserved?: boolean; fundsRestored?: boolean;
}
export function topUpState(result: VerifiedTopUp | null | undefined) {
  if(result?.verified===true && result.success===true && result.status==='success') return 'success';
  if(result?.status==='test_verified') return 'test';
  if(['failed','refunded','reversed'].includes(result?.status || '')) return 'failed';
  return 'pending'; // Includes forged/unverified success messages.
}
export const pendingChapaKey=(userId:string)=>`chapa:pending:${userId}`;
export const chapaRequestKey=(userId:string,amount:number,mode?:string)=>`chapa:initialize:${userId}:${amount}${mode ? ':'+mode : ''}`;
export const withdrawalRequestKey=(userId:string,fingerprint:string,mode:string)=>`chapa:withdrawal:${userId}:${mode}:${fingerprint}`;
export const withdrawalReferenceKey=(userId:string,reference:string)=>`chapa:withdrawal-reference:${userId}:${reference}`;
export async function withdrawalFingerprint(amount:number,bank:number,account:string,name:string) {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([amount,bank,account.trim(),name.normalize('NFKC').trim()])));
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function parseWalletAmount(value:string,min=10,max=1000000) { const amount=Number(value);return /^\d+$/.test(value) && Number.isSafeInteger(amount) && amount>=min && amount<=max ? amount : 0; }
const memory=new Map<string,string>();
export function readChapaStorage(key:string) { try {return localStorage.getItem(key) || memory.get(key) || null;} catch {return memory.get(key) || null;} }
export function writeChapaStorage(key:string,value:string) {memory.set(key,value);try{localStorage.setItem(key,value);}catch{/* Recovery also uses server intents. */}}
function removeChapaStorage(key:string) {memory.delete(key);try{localStorage.removeItem(key);}catch{/* Browser storage may be unavailable. */}}
export const clearChapaStorage=removeChapaStorage;
export function pendingChapaReference(userId?:string) { return userId ? readChapaStorage(pendingChapaKey(userId)) : null; }
export function recordTopUpResult(userId:string,result:VerifiedTopUp) {
  if(result.userId!==userId) return;
  if(result.kind==='withdrawal') {
    if(!['withdrawal_completed','withdrawal_restored','test_withdrawal_verified','failed','reversed'].includes(result.status) || !result.txRef) return;
    const referenceKey=withdrawalReferenceKey(userId,result.txRef),requestKey=readChapaStorage(referenceKey);
    if(requestKey && result.requestId && readChapaStorage(requestKey)===result.requestId) removeChapaStorage(requestKey);
    removeChapaStorage(referenceKey);
    return;
  }
  if(topUpState(result)==='pending') return;
  if(result.txRef && readChapaStorage(pendingChapaKey(userId))===result.txRef) removeChapaStorage(pendingChapaKey(userId));
  if(Number.isInteger(result.amount)) {
    removeChapaStorage(chapaRequestKey(userId,result.amount!));
    if(result.mode) removeChapaStorage(chapaRequestKey(userId,result.amount!,result.mode));
  }
}
