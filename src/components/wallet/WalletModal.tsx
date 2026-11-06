import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, FlaskConical, History, Info, WalletCards, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import { useUser } from '@/contexts/UserContext';
import { pendingChapaReference, topUpState } from '@/lib/chapaPayments';
import { WalletHistoryTab } from './WalletHistoryTab';
import { WalletTopUpTab } from './WalletTopUpTab';
import { WalletWithdrawTab } from './WalletWithdrawTab';
import './wallet.css';

interface WalletModalProps { isOpen: boolean; onClose: () => void }
const sections = {
  transactions: { title: 'Your activity', description: 'Payment receipts and coin movements, all in one place.' },
  topup: { title: 'Top up your wallet', description: 'Choose an amount, review it, then continue securely to Chapa.' },
  withdraw: { title: 'Withdraw to your bank', description: 'Review your amount and account details before you confirm.' },
};

const WalletModal = ({ isOpen, onClose }: WalletModalProps) => {
  const { user } = useUser();
  const { balance,totalEarned,totalSpent,isWalletLoading,isWalletError,initiateTopUp,verifyTopUp,requestWithdrawal,chapaBanks,chapaMode,isBanksLoading,isBanksError,retryBanks,invalidate } = useCoinWallet(user?.id);
  const [activeTab,setActiveTab] = useState<keyof typeof sections>('transactions');
  const [isVerifying,setIsVerifying] = useState(false);
  const checking = useRef(false);
  const [notice,setNotice] = useState<{title:string;message:string;tone:string}|null>(null);

  const checkOnReturn = useCallback(async () => {
    const reference = pendingChapaReference(user?.id);
    if (!isOpen || document.visibilityState !== 'visible' || !reference || checking.current) return;
    checking.current = true;setIsVerifying(true);
    try {
      const result = await verifyTopUp.mutateAsync({txRef:reference});
      const state = topUpState(result);
      setNotice({title:state==='success' ? 'Top-up successful' : state==='test' ? 'Test payment successful' : state==='pending' ? 'Payment awaiting confirmation' : 'Payment needs attention',
        message:result.message || 'Open your saved receipt to check the latest payment status.',tone:state==='success' ? 'success' : state==='failed' ? 'danger' : 'neutral'});
    } catch (error) {
      setNotice({title:'Status could not be checked',message:error instanceof Error ? error.message : 'Your receipt is still saved. Check History before paying again.',tone:'danger'});
    } finally {checking.current=false;setIsVerifying(false);}
  },[isOpen,user?.id,verifyTopUp.mutateAsync]);
  useEffect(()=>{
    document.addEventListener('visibilitychange',checkOnReturn);
    return ()=>document.removeEventListener('visibilitychange',checkOnReturn);
  },[checkOnReturn]);
  useEffect(()=>{setNotice(null);},[user?.id]);

  const section = sections[activeTab];
  return <Dialog.Root open={isOpen} onOpenChange={open=>{if(!open)onClose();}}>
    <Dialog.Portal>
      <Dialog.Content className="wallet-ui wallet-screen" aria-describedby="wallet-description">
        <header className="wallet-header">
          <div className="wallet-header-inner">
            <Dialog.Close className="wallet-back" aria-label="Back, close wallet"><ChevronLeft aria-hidden="true" size={20}/><span>Back</span></Dialog.Close>
            <div className="wallet-header-brand">
              <img src="/lovable-uploads/SerkleMainLogo.svg" alt="" />
              <div><Dialog.Title asChild><h1>Wallet</h1></Dialog.Title><p>Your Serkle balance & activity</p></div>
            </div>
            {chapaMode==='test' && <span className="wallet-mode"><FlaskConical size={13} aria-hidden="true"/>Test mode</span>}
          </div>
          <Dialog.Description id="wallet-description" className="sr-only">Manage your coin balance, top-ups, withdrawals and payment receipts.</Dialog.Description>
        </header>
        <div className="wallet-viewport">
          <div className="wallet-layout">
            <aside className="wallet-overview" aria-label="Wallet balance overview">
              <section className="wallet-balance-card" aria-labelledby="wallet-balance-label">
                <div className="wallet-balance-label"><h2 id="wallet-balance-label">Available balance</h2><WalletCards aria-hidden="true"/></div>
                {isWalletLoading ? <div className="py-6"><SerkleLoader dark label="Loading balance" showText /></div> : isWalletError ? <p className="wallet-balance-number text-2xl" role="status">Unavailable</p> : <>
                  <p className={`wallet-balance-number${balance.toLocaleString().length>9 ? ' wallet-balance-number--long' : ''}`}><span>{balance.toLocaleString()}</span><small>coins</small></p>
                  <p className="wallet-balance-equivalent">{balance.toLocaleString()} ETB equivalent</p>
                </>}
                <dl className="wallet-balance-stats">
                  <div><dt><ArrowDownLeft aria-hidden="true"/>Total received</dt><dd>{isWalletLoading ? <SerkleLoader dark size="xs" label="Loading received total"/> : isWalletError ? '—' : totalEarned.toLocaleString()}</dd></div>
                  <div><dt><ArrowUpRight aria-hidden="true"/>Total spent</dt><dd>{isWalletLoading ? <SerkleLoader dark size="xs" label="Loading spent total"/> : isWalletError ? '—' : totalSpent.toLocaleString()}</dd></div>
                </dl>
              </section>
              <div className="wallet-overview-note"><strong>Made for your Serkle moments.</strong>Support creators, unlock content and keep track of every coin.<p className="mt-3">1 ETB = 1 coin. Test payments do not change your spendable balance.</p></div>
            </aside>
            <section className="wallet-section" aria-label="Wallet actions">
              {isWalletError && <div role="alert" className="wallet-notice wallet-notice--danger mb-5"><Info aria-hidden="true"/><div><strong>Balance could not be refreshed</strong>Your previous transactions are still saved.<Button className="wallet-button wallet-button--quiet mt-2" variant="ghost" onClick={invalidate}>Retry balance</Button></div></div>}
              {notice && <div role={notice.tone==='danger' ? 'alert' : 'status'} className={`wallet-notice wallet-notice--${notice.tone} mb-5`}><Info aria-hidden="true"/><div className="flex-1 min-w-0"><strong>{notice.title}</strong><p>{notice.message}</p><button className="min-h-11 text-sm underline underline-offset-4" onClick={()=>setActiveTab('transactions')}>View payment history</button></div><button className="wallet-icon-button" aria-label="Dismiss payment message" onClick={()=>setNotice(null)}><X aria-hidden="true"/></button></div>}
              <Tabs value={activeTab} onValueChange={value=>setActiveTab(value as keyof typeof sections)}>
                <TabsList className="wallet-primary-tabs" aria-label="Wallet sections">
                  <TabsTrigger value="transactions"><History aria-hidden="true"/>History</TabsTrigger>
                  <TabsTrigger value="topup"><ArrowDownLeft aria-hidden="true"/>Top Up</TabsTrigger>
                  <TabsTrigger value="withdraw"><ArrowUpRight aria-hidden="true"/>Withdraw</TabsTrigger>
                </TabsList>
                <div className="wallet-section-heading"><h2>{section.title}</h2><p>{section.description}</p></div>
                <TabsContent value="transactions" className="wallet-panel mt-0"><WalletHistoryTab userId={user?.id} check={verifyTopUp}/></TabsContent>
                <TabsContent value="topup" className="wallet-panel mt-0"><WalletTopUpTab user={user} initiateTopUp={initiateTopUp} isVerifying={isVerifying} mode={chapaMode}/></TabsContent>
                <TabsContent value="withdraw" className="wallet-panel mt-0"><WalletWithdrawTab balance={balance} chapaBanks={chapaBanks} mode={chapaMode} isBanksLoading={isBanksLoading} isBanksError={isBanksError} retryBanks={retryBanks} requestWithdrawal={requestWithdrawal}/></TabsContent>
              </Tabs>
            </section>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
};
export default WalletModal;
