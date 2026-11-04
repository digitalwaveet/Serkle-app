import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Building2, ChevronDown, ArrowDownCircle } from 'lucide-react';
import { ChapaBank } from '@/hooks/useCoinWallet';
import { cn } from '@/lib/utils';

interface WalletWithdrawTabProps {
  balance: number;
  chapaBanks: ChapaBank[];
  isBanksLoading: boolean;
  requestWithdrawal: any;
}

export const WalletWithdrawTab: React.FC<WalletWithdrawTabProps> = ({
  balance,
  chapaBanks,
  isBanksLoading,
  requestWithdrawal,
}) => {
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState<ChapaBank | null>(null);
  const [bankSearch, setBankSearch] = useState('');
  const [showBankList, setShowBankList] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const filteredBanks = chapaBanks.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const withdrawAmount_num = parseInt(withdrawAmount) || 0;
  const withdrawValid =
    withdrawAmount_num >= 10 &&
    withdrawAmount_num <= balance &&
    accountName.trim().length > 0 &&
    accountNumber.trim().length > 0 &&
    !!selectedBank;

  const handleWithdraw = () => {
    const amount = parseInt(withdrawAmount);
    if (!amount || amount < 10 || amount > balance) return;
    if (!accountName.trim() || !accountNumber.trim() || !selectedBank) return;

    requestWithdrawal.mutate({
      amount,
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
      bankCode: selectedBank.id,
    });

    setWithdrawAmount('');
    setAccountName('');
    setAccountNumber('');
    setSelectedBank(null);
    setBankSearch('');
  };

  return (
    <div className="space-y-4">
      {/* Amount input */}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount (ETB)</p>
          <span className="text-xs text-muted-foreground">Max: {balance.toLocaleString()} ETB</span>
        </div>
        <Input
          type="number"
          placeholder="Min. 10 ETB"
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          min="10"
          max={balance}
          className="rounded-xl bg-card/40 backdrop-blur-sm border-border/30"
        />
      </div>

      {/* Account name */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account holder name</p>
        <Input
          placeholder="Full name as registered at bank"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          className="rounded-xl bg-card/40 backdrop-blur-sm border-border/30"
        />
      </div>

      {/* Bank picker */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bank / Mobile Wallet</p>
        <Popover open={showBankList} onOpenChange={setShowBankList}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between rounded-xl bg-card/40 backdrop-blur-sm border border-border/30 px-3 py-2.5 text-sm text-left"
            >
              <span className={selectedBank ? 'text-foreground flex items-center gap-2' : 'text-muted-foreground'}>
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                {selectedBank ? selectedBank.name : (isBanksLoading ? 'Loading banks…' : 'Select bank / wallet')}
              </span>
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', showBankList && 'rotate-180')} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] z-[250] p-0 rounded-xl bg-card border border-border/40 shadow-xl overflow-hidden"
            align="start"
            sideOffset={4}
          >
            <div className="p-2 border-b border-border/30">
              <Input
                placeholder="Search bank…"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="rounded-lg bg-card/70 border-border/20 text-sm h-8"
                autoFocus
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filteredBanks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No banks found</p>
              ) : (
                filteredBanks.map((bank) => (
                  <button
                    key={bank.id}
                    onClick={() => {
                      setSelectedBank(bank);
                      setShowBankList(false);
                      setBankSearch('');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary/10 transition-colors flex items-center gap-2"
                  >
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {bank.name}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Account number */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Account / Wallet number
          {selectedBank && <span className="ml-1 normal-case text-muted-foreground/60">({selectedBank.acct_length} digits)</span>}
        </p>
        <Input
          placeholder={selectedBank ? `${selectedBank.acct_length}-digit account number` : 'Account number'}
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          maxLength={selectedBank?.acct_length ?? 20}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          className="rounded-xl bg-card/40 backdrop-blur-sm border-border/30"
        />
      </div>

      {/* Summary */}
      {withdrawAmount_num >= 10 && selectedBank && (
        <div className="rounded-xl bg-card/40 backdrop-blur-sm border border-border/30 p-3.5 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">You withdraw</span>
            <span className="font-semibold text-foreground">{withdrawAmount_num} ETB</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>To</span>
            <span>{selectedBank.name}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>New balance</span>
            <span>{(balance - withdrawAmount_num).toLocaleString()} coins</span>
          </div>
        </div>
      )}

      <Button
        onClick={() => setShowWithdrawConfirm(true)}
        disabled={!withdrawValid || requestWithdrawal.isPending}
        variant="outline"
        className="w-full rounded-xl gap-2 border-border/40 backdrop-blur-sm touch-target-large"
        size="lg"
      >
        {requestWithdrawal.isPending ? (
          <><SerkleLoader size="xs" className="text-current" /> Processing…</>
        ) : (
          <><ArrowDownCircle className="w-4 h-4" /> Request Withdrawal</>
        )}
      </Button>

      <AlertDialog open={showWithdrawConfirm} onOpenChange={setShowWithdrawConfirm}>
        <AlertDialogContent className="z-[250]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Withdrawal</AlertDialogTitle>
            <AlertDialogDescription>
              Withdraw <strong>{withdrawAmount_num} ETB</strong> to{' '}
              <strong>{selectedBank?.name}</strong> account <strong>{accountNumber}</strong> ({accountName})?
              <br /><br />
              Coins will be debited immediately and this action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowWithdrawConfirm(false);
                handleWithdraw();
              }}
            >
              Confirm Withdrawal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="text-[10px] text-muted-foreground text-center">
        Withdrawals are processed via Chapa within 3-5 business days.
        Coins are debited immediately upon request.
      </p>
    </div>
  );
};
