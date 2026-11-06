import { useId, useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { ArrowUpRight, Building2, ChevronDown, FlaskConical, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import type { ChapaBank } from '@/hooks/useCoinWallet';
import { parseWalletAmount } from '@/lib/chapaPayments';

interface Props {balance:number;chapaBanks:ChapaBank[];isBanksLoading:boolean;requestWithdrawal:any;mode?:'test'|'live';isBanksError?:boolean;retryBanks?:()=>unknown}
export function WalletWithdrawTab({balance,chapaBanks,isBanksLoading,requestWithdrawal,mode,isBanksError,retryBanks}:Props) {
  const id=useId();
  const [amountInput,setAmountInput]=useState('');
  const [accountName,setAccountName]=useState('');
  const [accountNumber,setAccountNumber]=useState('');
  const [bank,setBank]=useState<ChapaBank|null>(null);
  const [search,setSearch]=useState('');
  const [bankOpen,setBankOpen]=useState(false);
  const [confirmOpen,setConfirmOpen]=useState(false);
  const amount=parseWalletAmount(amountInput);
  const amountError=amountInput && (!amount || (mode==='live' && amount>balance)) ? (mode==='live' && amount>balance ? 'This amount is more than your available balance.' : 'Enter a whole amount from 10 to 1,000,000 ETB.') : '';
  const accountError=accountNumber && !/^\d{6,30}$/.test(accountNumber) ? 'Enter 6–30 digits, without spaces or symbols.' : '';
  const valid=!!amount && !!mode && !amountError && !!accountName.trim() && !!bank && /^\d{6,30}$/.test(accountNumber) && !isBanksError;
  const submit=()=>{
    if(!valid || requestWithdrawal.isPending)return;
    requestWithdrawal.mutate({amount,accountName:accountName.trim(),accountNumber:accountNumber.trim(),bankCode:bank!.id,expectedMode:mode},{onSuccess:(data:any)=>{
      if(data.status==='failed')return;
      setAmountInput('');setAccountName('');setAccountNumber('');setBank(null);setSearch('');
    }});
  };
  return <div className="wallet-surface space-y-6">
    {mode==='test' && <div className="wallet-notice"><FlaskConical aria-hidden="true"/><p>Test mode: withdrawals are recorded for testing. No spendable coins or real funds will be removed.</p></div>}
    {isBanksError && <div role="alert" className="wallet-notice wallet-notice--danger"><Info aria-hidden="true"/><div><strong>Bank list could not be loaded</strong><p>Refresh it before requesting a withdrawal.</p><Button variant="ghost" className="wallet-button wallet-button--quiet mt-2" onClick={()=>void retryBanks?.()}>Retry bank list</Button></div></div>}
    {!mode && !isBanksLoading && !isBanksError && <p role="status" className="wallet-notice">Withdrawal configuration is unavailable. Refresh your wallet before continuing.</p>}
    <div className="wallet-field"><label htmlFor={`${id}-amount`}>Amount (ETB)</label><div className="wallet-amount-input"><Input id={`${id}-amount`} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="Min. 10 ETB" value={amountInput} onChange={event=>setAmountInput(event.target.value)} aria-invalid={!!amountError} aria-describedby={`${id}-amount-help`}/><span aria-hidden="true">ETB</span></div><p id={`${id}-amount-help`} className={amountError ? 'wallet-field-error' : 'wallet-field-help'}>{amountError || `Minimum 10 ETB · Maximum ${mode==='test' ? '1,000,000' : balance.toLocaleString()} ETB`}</p></div>
    <div className="wallet-field"><label htmlFor={`${id}-name`}>Account holder name</label><Input id={`${id}-name`} autoComplete="name" placeholder="Full name as registered at bank" value={accountName} onChange={event=>setAccountName(event.target.value)} maxLength={100}/></div>
    <div className="wallet-field"><label htmlFor={`${id}-bank`}>Bank / mobile wallet</label>
      <Popover open={bankOpen} onOpenChange={setBankOpen}><PopoverTrigger asChild><button id={`${id}-bank`} type="button" className="wallet-bank-trigger" aria-label={bank ? `Selected bank: ${bank.name}` : 'Select bank or mobile wallet'} disabled={isBanksLoading || !!isBanksError}><span><Building2 aria-hidden="true"/>{bank ? bank.name : isBanksLoading ? 'Loading banks…' : 'Select bank / wallet'}</span><ChevronDown aria-hidden="true"/></button></PopoverTrigger>
        <PopoverContent className="wallet-ui wallet-bank-menu" align="start" sideOffset={8}>
          <div className="wallet-field"><label className="sr-only" htmlFor={`${id}-search`}>Search banks</label><Input id={`${id}-search`} placeholder="Search bank…" value={search} onChange={event=>setSearch(event.target.value)} autoComplete="off"/></div>
          <div className="wallet-bank-options mt-2" aria-label="Available banks">{chapaBanks.filter(item=>item.name.toLowerCase().includes(search.toLowerCase())).map(item=><button key={item.id} type="button" onClick={()=>{setBank(item);setBankOpen(false);setSearch('');}}><Building2 aria-hidden="true"/>{item.name}</button>)}{!chapaBanks.some(item=>item.name.toLowerCase().includes(search.toLowerCase())) && <p role="status" className="p-4 text-sm text-muted-foreground">No banks found</p>}</div>
        </PopoverContent>
      </Popover>
    </div>
    <div className="wallet-field"><label htmlFor={`${id}-account`}>Account / wallet number</label><Input id={`${id}-account`} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder={bank ? `${bank.acct_length}-digit account number` : 'Account number'} value={accountNumber} onChange={event=>setAccountNumber(event.target.value)} maxLength={bank?.acct_length || 30} aria-invalid={!!accountError} aria-describedby={`${id}-account-help`}/><p id={`${id}-account-help`} className={accountError ? 'wallet-field-error' : 'wallet-field-help'}>{accountError || 'Double-check this number. Your receipt will show only its last four digits.'}</p></div>
    {!!amount && bank && !amountError && <div className="wallet-summary"><dl><div><dt>Withdrawal amount</dt><dd>{amount.toLocaleString()} ETB</dd></div><div><dt>To</dt><dd>{bank.name}</dd></div><div><dt>Balance after reservation</dt><dd>{mode==='test' ? 'Unchanged in test mode' : `${(balance-amount).toLocaleString()} coins`}</dd></div></dl></div>}
    <Button className="wallet-button wallet-button--primary w-full" disabled={!valid || requestWithdrawal.isPending} onClick={()=>setConfirmOpen(true)}>{requestWithdrawal.isPending ? <><SerkleLoader size="xs" className="text-current" label="Recording withdrawal"/>Processing…</> : <>Request Withdrawal<ArrowUpRight aria-hidden="true"/></>}</Button>
    <p className="wallet-field-help">Your withdrawal is recorded in History. Checking its status never sends another payout.</p>
    {requestWithdrawal.isError && <p role="alert" className="wallet-notice wallet-notice--danger"><Info aria-hidden="true"/><span>{requestWithdrawal.error?.message || 'The request could not be confirmed. Check History before trying another withdrawal.'}</span></p>}
    {requestWithdrawal.isSuccess && requestWithdrawal.data?.message && <p role="status" className="wallet-notice">{requestWithdrawal.data.message} Open History to view its receipt.</p>}
    <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}><AlertDialog.Portal><AlertDialog.Overlay className="wallet-dialog-overlay wallet-confirm-overlay"/><AlertDialog.Content className="wallet-ui wallet-confirm">
      <AlertDialog.Title>{mode==='test' ? 'Confirm Test Withdrawal' : 'Confirm Withdrawal'}</AlertDialog.Title>
      <div className="wallet-summary"><dl><div><dt>Amount</dt><dd>{amount.toLocaleString()} ETB</dd></div><div><dt>Bank</dt><dd>{bank?.name}</dd></div><div><dt>Account</dt><dd>{accountNumber}</dd></div><div><dt>Account holder</dt><dd>{accountName}</dd></div></dl></div>
      <AlertDialog.Description>{mode==='test' ? 'This is a test. No spendable coins or real funds will be removed.' : 'Coins will be reserved while Chapa processes this withdrawal. They are returned only after a confirmed failure. Review the bank details carefully.'}</AlertDialog.Description>
      <div className="wallet-confirm-buttons"><AlertDialog.Cancel asChild><Button variant="outline" className="wallet-button wallet-button--secondary">Cancel</Button></AlertDialog.Cancel><AlertDialog.Action asChild><Button className="wallet-button wallet-button--primary" onClick={()=>{setConfirmOpen(false);submit();}}>Confirm Withdrawal</Button></AlertDialog.Action></div>
    </AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>
  </div>;
}
