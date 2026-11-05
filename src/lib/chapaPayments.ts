// Use the approved app callback even when checkout starts on another host.
export const CHAPA_RETURN_URL = 'https://serkle-app-five.vercel.app/verify';

export interface VerifiedTopUp {
  status: string;
  success?: boolean;
  verified?: boolean;
  txRef?: string;
  userId?: string;
  amount?: number;
  message?: string;
}
export function topUpState(result: VerifiedTopUp | null | undefined) {
  if(result?.verified===true && result.success===true && result.status==='success') return 'success';
  if(['failed','refunded','reversed','test_verified'].includes(result?.status || '')) return 'failed';
  return 'pending'; // Includes forged/unverified success messages.
}
export const pendingChapaKey=(userId:string)=>`chapa:pending:${userId}`;
export const chapaRequestKey=(userId:string,amount:number)=>`chapa:initialize:${userId}:${amount}`;
const memory=new Map<string,string>();
export function readChapaStorage(key:string) { try {return localStorage.getItem(key) || memory.get(key) || null;} catch {return memory.get(key) || null;} }
export function writeChapaStorage(key:string,value:string) {memory.set(key,value);try{localStorage.setItem(key,value);}catch{/* Recovery also uses server intents. */}}
function removeChapaStorage(key:string) {memory.delete(key);try{localStorage.removeItem(key);}catch{/* Browser storage may be unavailable. */}}
export function pendingChapaReference(userId?:string) { return userId ? readChapaStorage(pendingChapaKey(userId)) : null; }
export function recordTopUpResult(userId:string,result:VerifiedTopUp) {
  if(result.userId!==userId) return;
  if(topUpState(result)==='pending') return;
  if(result.txRef && readChapaStorage(pendingChapaKey(userId))===result.txRef) removeChapaStorage(pendingChapaKey(userId));
  if(Number.isInteger(result.amount)) removeChapaStorage(chapaRequestKey(userId,result.amount!));
}
