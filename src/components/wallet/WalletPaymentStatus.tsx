import { AlertCircle, CheckCircle2, Clock3, FlaskConical, RotateCcw } from 'lucide-react';
import { walletPaymentStatus, walletPaymentTone, type WalletPayment } from '@/lib/walletHistory';

export function WalletPaymentStatus({payment}: {payment:WalletPayment}) {
  const tone=walletPaymentTone(payment);
  const Icon={success:CheckCircle2,danger:AlertCircle,pending:Clock3,test:FlaskConical,neutral:RotateCcw}[tone];
  return <span className={`wallet-status wallet-status--${tone}`}><Icon aria-hidden="true"/>{walletPaymentStatus(payment)}</span>;
}
