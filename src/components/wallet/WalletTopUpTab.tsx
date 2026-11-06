import { useEffect, useId, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FlaskConical, Info, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { supabase } from '@/integrations/supabase/client';
import { parseWalletAmount, pendingChapaKey, writeChapaStorage } from '@/lib/chapaPayments';

const amounts=[10,25,50,100,250,500];
const validEmail=(value?:string)=>!!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && !value.endsWith('@placeholder.com');
interface Props { user:any;initiateTopUp:any;isVerifying:boolean;mode?:'test'|'live' }

export function WalletTopUpTab({user,initiateTopUp,isVerifying,mode}:Props) {
  const id=useId();
  const [preset,setPreset]=useState<number|null>(null);
  const [custom,setCustom]=useState('');
  const [step,setStep]=useState<'amount'|'review'>('amount');
  const [email,setEmail]=useState(user?.email || '');
  const [newEmail,setNewEmail]=useState('');
  const [savingEmail,setSavingEmail]=useState(false);
  const [emailError,setEmailError]=useState<string|null>(null);
  const [emailSaved,setEmailSaved]=useState(false);
  useEffect(()=>{setEmail(user?.email || '');setNewEmail('');setEmailError(null);setEmailSaved(false);},[user?.id,user?.email]);
  const amount=preset || parseWalletAmount(custom);
  const needsEmail=!validEmail(email);
  const amountError=custom && !parseWalletAmount(custom) ? 'Enter a whole amount from 10 to 1,000,000 ETB.' : '';

  const saveEmail=async()=>{
    const value=newEmail.trim();setEmailError(null);
    if(!validEmail(value)){setEmailError('Enter a valid email address.');return;}
    setSavingEmail(true);
    try {
      const {error}=await supabase.from('profiles').update({email:value}).eq('id',user.id);
      if(error)throw error;
      const {error:authError}=await supabase.auth.updateUser({email:value});
      if(authError)console.warn('Could not update auth email:',authError.message);
      setEmail(value);setNewEmail('');setEmailSaved(true);
    } catch(error){setEmailError(error instanceof Error ? error.message : 'Email could not be saved. Please try again.');}
    finally{setSavingEmail(false);}
  };
  const pay=()=>{
    if(!amount || needsEmail || initiateTopUp.isPending || isVerifying)return;
    initiateTopUp.mutate({amount,email,firstName:user?.name?.split(' ')[0] || 'User',lastName:user?.name?.split(' ').slice(1).join(' ') || '',phoneNumber:user?.phone || undefined},{
      onSuccess:(result:any)=>{
        if(!result?.checkoutUrl)return;
        if(result.txRef)writeChapaStorage(pendingChapaKey(user.id),result.txRef);
        window.location.href=result.checkoutUrl;
      },
    });
  };
  return <div className="wallet-surface space-y-6">
    <ol className="wallet-steps" aria-label="Top-up progress"><li aria-current={step==='amount' ? 'step' : undefined}><span>{step==='review' ? <Check size={13} aria-hidden="true"/> : '1'}</span>Amount</li><li aria-current={step==='review' ? 'step' : undefined}><span>2</span>Review & pay</li></ol>
    {mode==='test' && <div className="wallet-notice"><FlaskConical aria-hidden="true"/><p>Test mode: this payment will be recorded for testing. It will not add spendable coins.</p></div>}
    {step==='amount' ? <>
      {needsEmail && <div className="wallet-notice"><Mail aria-hidden="true"/><div className="min-w-0 flex-1 space-y-3"><strong>Add a receipt email</strong><p>Provide an email for your Chapa payment receipt.</p><div className="wallet-field"><label htmlFor={`${id}-email`}>Receipt email</label><Input id={`${id}-email`} type="email" autoComplete="email" placeholder="you@example.com" value={newEmail} onChange={event=>setNewEmail(event.target.value)} aria-invalid={!!emailError} aria-describedby={emailError ? `${id}-email-error` : undefined}/></div><Button className="wallet-button wallet-button--secondary" variant="outline" onClick={()=>void saveEmail()} disabled={savingEmail || !newEmail.trim()}>{savingEmail ? <SerkleLoader size="xs" label="Saving email"/> : 'Save email'}</Button>{emailError && <p role="alert" id={`${id}-email-error`} className="wallet-field-error">{emailError}</p>}</div></div>}
      {emailSaved && <p role="status" className="wallet-field-help">Receipt email saved.</p>}
      <fieldset className="wallet-field"><legend>Choose an amount</legend><div className="wallet-presets">{amounts.map(value=><button key={value} type="button" aria-pressed={preset===value} onClick={()=>{setPreset(value);setCustom('');}}>{value.toLocaleString()}<small>ETB</small></button>)}</div></fieldset>
      <div className="wallet-field"><label htmlFor={`${id}-amount`}>Or enter a custom amount</label><div className="wallet-amount-input"><Input id={`${id}-amount`} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="Enter ETB amount (min. 10)" value={custom} onChange={event=>{setCustom(event.target.value);setPreset(null);}} aria-invalid={!!amountError} aria-describedby={`${id}-amount-help`}/><span aria-hidden="true">ETB</span></div><p id={`${id}-amount-help`} className={amountError ? 'wallet-field-error' : 'wallet-field-help'}>{amountError || 'Minimum 10 ETB. Use whole amounts. 1 ETB = 1 coin.'}</p></div>
      {!!amount && <div className="wallet-summary"><dl><div><dt>{mode==='test' ? 'Test top-up amount' : 'Coins after verified live payment'}</dt><dd>{amount.toLocaleString()} {mode==='test' ? 'ETB' : 'coins'}</dd></div></dl></div>}
      <Button className="wallet-button wallet-button--primary w-full" onClick={()=>{if(amount && !needsEmail)setStep('review');}} disabled={!amount || needsEmail}>Continue to Review<ArrowRight aria-hidden="true"/></Button>
    </> : <>
      <button className="wallet-button wallet-button--quiet inline-flex items-center p-0" onClick={()=>setStep('amount')}><ArrowLeft aria-hidden="true"/>Back to amount selection</button>
      <div className="wallet-summary"><h3 className="mb-3 font-semibold">Review your top-up</h3><dl>
        <div><dt>Top-up amount</dt><dd>{amount.toLocaleString()} ETB</dd></div>
        <div><dt>{mode==='test' ? 'Spendable coin credit' : 'Coins after verified live payment'}</dt><dd>{mode==='test' ? 'None · test payment' : `${amount.toLocaleString()} coins`}</dd></div>
        <div><dt>App top-up fee</dt><dd>No app fee</dd></div>
        <div><dt>Receipt email</dt><dd>{email}</dd></div>
        <div className="wallet-summary-total"><dt>Total to pay</dt><dd>{amount.toLocaleString()} ETB</dd></div>
      </dl></div>
      <Button className="wallet-button wallet-button--primary w-full" onClick={pay} disabled={initiateTopUp.isPending || isVerifying}>{initiateTopUp.isPending || isVerifying ? <><SerkleLoader size="xs" className="text-current" label={isVerifying ? 'Verifying payment' : 'Connecting to Chapa'}/>{isVerifying ? 'Verifying payment…' : 'Connecting to Chapa…'}</> : <>Pay {amount.toLocaleString()} ETB with Chapa<ArrowRight aria-hidden="true"/></>}</Button>
      <p className="wallet-field-help text-center">You will confirm your payment on Chapa’s secure hosted checkout.</p>
    </>}
    {initiateTopUp.isError && <p role="alert" className="wallet-notice wallet-notice--danger"><Info aria-hidden="true"/><span>{initiateTopUp.error?.message || 'Checkout could not be confirmed. Check your saved payment in History before paying again.'}</span></p>}
  </div>;
}
