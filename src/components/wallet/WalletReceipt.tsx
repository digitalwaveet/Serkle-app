import type { ReactNode } from 'react';
import { walletDate, walletMoney, type WalletPayment } from '@/lib/walletHistory';
import type { CoinTransaction } from '@/hooks/useCoinWallet';
import { WalletPaymentStatus } from './WalletPaymentStatus';

function Field({label,value,reference=false}: {label:string;value:ReactNode;reference?:boolean}) {
  return <div><dt>{label}</dt><dd className={reference ? 'wallet-reference' : undefined}>{value}</dd></div>;
}

/** Renders only saved receipt fields and linked journal entries, never a mock invoice. */
export function WalletReceipt({payment,ledger}: {payment:WalletPayment;ledger:CoinTransaction[]}) {
  const withdrawal=payment.kind==='withdrawal';
  return <article className="wallet-receipt-paper" aria-label="Serkle payment receipt" data-mode={payment.mode}>
    <header className="wallet-receipt-brand">
      <img src="/lovable-uploads/SerkleMainLogo.svg" alt=""/>
      <strong>SERKLE</strong><p>{withdrawal ? 'Withdrawal receipt' : 'Wallet payment receipt'}</p>
    </header>
    <div className="wallet-receipt-amount">
      <div className={`wallet-money${walletMoney(payment.amount,payment.currency).length>14 ? ' wallet-money--long' : ''}`}>{walletMoney(payment.amount,payment.currency)}</div>
      <WalletPaymentStatus payment={payment}/>
      <p>{payment.mode==='test' ? 'TEST TRANSACTION · No real wallet credit or debit' : withdrawal ? 'Bank / mobile wallet withdrawal' : 'Wallet top-up via Chapa'}</p>
    </div>
    <div className="wallet-receipt-perforation" aria-hidden="true"/>
    <div className="wallet-receipt-details"><dl>
      <Field label="Receipt ID" value={payment.id} reference/>
      <Field label="Payment reference" value={payment.tx_ref} reference/>
      <Field label="Provider receipt" value={payment.provider_reference || 'Not yet confirmed'} reference/>
      <Field label="Environment" value={payment.mode==='test' ? 'Test payment' : 'Live payment'}/>
      <Field label="Payment method" value={payment.payment_method || 'Not provided'}/>
      <Field label="Amount" value={walletMoney(payment.amount,payment.currency)}/>
      <Field label="Provider-reported fee" value={payment.provider_fee==null ? 'Not provided' : walletMoney(payment.provider_fee,payment.currency)}/>
      <Field label="Created" value={walletDate(payment.created_at)}/>
      <Field label="Last verified" value={walletDate(payment.verified_at)}/>
      {withdrawal ? <>
        <Field label="Destination" value={payment.destination_hint || 'Not provided'}/>
        <Field label="Submission started" value={walletDate(payment.submitted_at)}/>
        <Field label="Coins reserved" value={walletDate(payment.reserved_at)}/>
        <Field label="Coins returned" value={walletDate(payment.restored_at)}/>
      </> : <>
        <Field label="Wallet credited" value={walletDate(payment.credited_at)}/>
        <Field label="Funding reversed" value={walletDate(payment.reversed_at)}/>
      </>}
    </dl></div>
    <section className="wallet-receipt-movements" aria-label="Recorded wallet movements"><h3>Recorded wallet movements</h3>
      {!ledger.length && <p>No spendable coin movement has been recorded for this payment.</p>}
      {ledger.map(entry=><div key={entry.id} className="wallet-receipt-ledger">
        <strong>{entry.amount>0 ? '+' : ''}{entry.amount.toLocaleString()} coins</strong>
        <p>Balance after: {entry.balance_after.toLocaleString()} coins</p>
        <p>{entry.description} · {walletDate(entry.created_at)}</p>
        <p className="mt-2 font-mono text-[10px]">Ledger entry: {entry.id}</p>
      </div>)}
    </section>
    <footer className="wallet-receipt-footer"><strong>{payment.mode==='test' ? 'For testing only. No spendable coins were moved.' : 'Keep this receipt for your records.'}</strong>Reflects the saved payment status and recorded wallet movements. All times use your local timezone.</footer>
  </article>;
}
