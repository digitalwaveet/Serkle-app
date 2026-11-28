import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { listCircleAdmins, updateCircleAdmin, type CircleAdmin, type CircleAdminAction } from '@/lib/circleAdmin';
import { membershipQueryOptions, refreshCircleMembership } from '@/lib/circleMembershipClient';

const permissions = [
  { action: 'invite', field: 'can_invite_members', label: 'Share member invite links' },
  { action: 'requests', field: 'can_respond_to_requests', label: 'Approve or decline join requests' },
] as const;

export default function CircleAdminControls({ circleId, ownerId, onAdd }: {
  circleId: string;
  ownerId: string;
  onAdd: () => void;
}) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<CircleAdmin | null>(null);
  const queryKey = ['circle-admins', circleId, ownerId];
  const admins = useQuery({ queryKey, queryFn: () => listCircleAdmins(circleId), ...membershipQueryOptions });

  const update = useMutation({
    mutationFn: ({ userId, action, allowed }: { userId: string; action: CircleAdminAction; allowed?: boolean }) =>
      updateCircleAdmin(circleId, userId, action, allowed),
    onSuccess: async (_, { action }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        refreshCircleMembership(queryClient),
      ]);
      if (action === 'remove') setRemoving(null);
      toast.success(action === 'remove' ? 'Admin access removed' : 'Admin permission updated');
    },
    onError: () => toast.error('Could not update admin access. Please try again.'),
  });

  return (
    <div className="px-4 pb-4 space-y-4">
      <Button size="sm" onClick={onAdd} disabled={update.isPending}>
        <ShieldPlus className="h-4 w-4 mr-2" /> Add Admin
      </Button>
      {admins.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading admins…</p>}
      {admins.isError && (
        <div role="alert" className="space-y-2 text-sm">
          <p>Could not load Circle admins.</p>
          <Button size="sm" variant="outline" onClick={() => admins.refetch()}>Try again</Button>
        </div>
      )}
      {admins.isSuccess && admins.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Admins appear here when they accept their invitation.</p>
      )}
      {admins.isSuccess && admins.data.map((admin) => {
        const name = admin.name || admin.username || 'Circle admin';
        return (
          <fieldset key={admin.user_id} className="min-w-0 rounded-lg border px-3 pb-3 space-y-3">
            <legend className="px-1 font-medium text-sm break-all">{name}</legend>
            {admin.username && <p className="text-xs text-muted-foreground break-all">@{admin.username}</p>}
            {permissions.map(({ action, field, label }) => (
              <label key={action} className="flex items-center justify-between gap-3 text-sm">
                {label}
                <Switch
                  checked={admin[field]}
                  disabled={update.isPending}
                  onCheckedChange={(allowed) => update.mutate({ userId: admin.user_id, action, allowed })}
                />
              </label>
            ))}
            <Button size="sm" variant="outline" onClick={() => setRemoving(admin)} disabled={update.isPending}>
              Remove admin access
            </Button>
          </fieldset>
        );
      })}
      <AlertDialog open={!!removing} onOpenChange={(open) => { if (!open && !update.isPending) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove admin access?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name || removing?.username || 'This admin'} will stay in the Circle as a member.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={update.isPending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={update.isPending} onClick={() => {
              if (removing) update.mutate({ userId: removing.user_id, action: 'remove' });
            }}>Remove admin access</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
