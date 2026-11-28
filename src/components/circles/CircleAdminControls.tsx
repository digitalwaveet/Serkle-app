import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CIRCLE_ACTIVITY_PERMISSIONS, defaultCircleActivityPermission, listCircleAdmins, updateCircleAdmin, type CircleAdmin, type CircleAdminAction } from '@/lib/circleAdmin';
import { getCircleType, normalizeFeatures } from '@/lib/circleTypes';
import { type Circle } from '@/hooks/useCircles';
import { membershipQueryOptions, refreshCircleMembership } from '@/lib/circleMembershipClient';

const permissions = [
  { action: 'invite', field: 'can_invite_members', label: 'Share member invite links' },
  { action: 'requests', field: 'can_respond_to_requests', label: 'Approve or decline join requests' },
] as const;

export default function CircleAdminControls({ circle, userId, onAdd }: {
  circle: Circle;
  userId: string;
  onAdd: () => void;
}) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<CircleAdmin | null>(null);
  const queryKey = ['circle-admins', circle.id, userId];
  const admins = useQuery({ queryKey, queryFn: () => listCircleAdmins(circle.id), ...membershipQueryOptions });
  const isOwner = circle.creator_id === userId;
  const enabledFeatures = normalizeFeatures(circle.enabled_features);
  const activities = CIRCLE_ACTIVITY_PERMISSIONS.filter(({ feature }) => !feature || enabledFeatures.includes(feature));

  const update = useMutation({
    mutationFn: ({ userId, action, allowed }: { userId: string; action: CircleAdminAction; allowed?: boolean }) =>
      updateCircleAdmin(circle.id, userId, action, allowed),
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
      <p className="text-xs text-muted-foreground">
        Showing permissions for the enabled activities in this {getCircleType(circle.circle_type).label} Circle.
      </p>
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
      {admins.isSuccess && admins.data.length > 0 && (
        <Accordion type="single" collapsible className="space-y-2">
          {admins.data.map((admin) => {
            const name = admin.name || admin.username || 'Circle admin';
            const canEdit = isOwner || (!admin.is_super_admin && admin.user_id !== userId);
            const locked = !canEdit || !!admin.is_super_admin || update.isPending;
            return (
              <AccordionItem key={admin.user_id} value={admin.user_id} className="min-w-0 rounded-lg border">
                <AccordionTrigger className="min-h-14 min-w-0 gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/60 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{name}</span>
                    {admin.username && <span className="block truncate text-xs text-muted-foreground">@{admin.username}</span>}
                  </span>
                  {admin.is_super_admin ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950 dark:bg-amber-950 dark:text-amber-200">
                      <ShieldCheck aria-hidden="true" className="size-3.5" />
                      Super Admin
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">Admin</span>
                  )}
                </AccordionTrigger>
                <AccordionContent className="border-t px-3 pb-3 pt-3">
                  <fieldset className="min-w-0 space-y-3">
                    <legend className="sr-only">Permissions for {name}</legend>
                    <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 text-sm font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100">
                      <span className="inline-flex items-center gap-2">
                        <ShieldCheck aria-hidden="true" className="size-4" /> Super Admin
                      </span>
                      <Switch
                        className="data-[state=checked]:bg-amber-700 dark:data-[state=checked]:bg-amber-400"
                        checked={!!admin.is_super_admin}
                        disabled={!isOwner || update.isPending}
                        onCheckedChange={(allowed) => update.mutate({ userId: admin.user_id, action: 'super_admin', allowed })}
                      />
                    </label>
                    {admin.is_super_admin && <p className="text-xs text-muted-foreground">All Circle activity permissions are on. Individual settings are restored if Super Admin is turned off.</p>}
                    {permissions.map(({ action, field, label }) => (
                      <label key={action} className="flex items-center justify-between gap-3 text-sm">
                        {label}
                        <Switch
                          checked={!!admin.is_super_admin || admin[field]}
                          disabled={locked}
                          onCheckedChange={(allowed) => update.mutate({ userId: admin.user_id, action, allowed })}
                        />
                      </label>
                    ))}
                    {activities.map(({ id, label }) => (
                      <label key={id} className="flex items-center justify-between gap-3 text-sm">
                        {label}
                        <Switch
                          checked={!!admin.is_super_admin || (admin.activity_permissions?.[id] ?? defaultCircleActivityPermission(id))}
                          disabled={locked}
                          onCheckedChange={(allowed) => update.mutate({ userId: admin.user_id, action: id, allowed })}
                        />
                      </label>
                    ))}
                    {canEdit && <Button size="sm" variant="outline" onClick={() => setRemoving(admin)} disabled={update.isPending}>
                      Remove admin access
                    </Button>}
                  </fieldset>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
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
