import { Button } from '@/components/ui/button';
import { circleMembershipAction, type CircleMembershipSnapshot } from '@/lib/circleMembershipState';

export function CircleMembershipButton({ snapshot, busy, onClick, size = 'sm' }: {
  snapshot?: CircleMembershipSnapshot;
  busy?: boolean;
  onClick: () => void;
  size?: 'sm' | 'default';
}) {
  const action = circleMembershipAction(snapshot, busy);
  return <Button size={size} variant={action.isJoined || snapshot?.state === 'pending' ? 'outline' : 'default'}
    disabled={action.disabled} aria-busy={busy || undefined} onClick={onClick}>{action.label}</Button>;
}
