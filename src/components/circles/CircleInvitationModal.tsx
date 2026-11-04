import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { Shield, ArrowRightLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRespondToInvitation, CircleInvitation } from '@/hooks/useCircleInvitations';
import { supabase } from '@/integrations/supabase/client';

interface CircleInvitationModalProps {
  invitationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CircleInvitationModal: React.FC<CircleInvitationModalProps> = ({ invitationId, open, onOpenChange }) => {
  const { respond } = useRespondToInvitation();
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState<CircleInvitation | null>(null);
  const [circleName, setCircleName] = useState('');
  const [inviterName, setInviterName] = useState('');

  useEffect(() => {
    if (!invitationId || !open) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('circle_invitations')
        .select('*')
        .eq('id', invitationId)
        .single();
      if (data) {
        setInvitation(data as CircleInvitation);
        // Get circle name
        const { data: circle } = await supabase
          .from('circles')
          .select('name')
          .eq('id', data.circle_id)
          .single();
        if (circle) setCircleName(circle.name);
        // Get inviter name
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', data.inviter_id)
          .single();
        if (profile) setInviterName(profile.name);
      }
    };
    fetch();
  }, [invitationId, open]);

  const handleRespond = async (accept: boolean) => {
    if (!invitationId) return;
    setLoading(true);
    await respond(invitationId, accept);
    setLoading(false);
    onOpenChange(false);
  };

  if (!invitation) return null;

  const isAdmin = invitation.invitation_type === 'admin';
  const Icon = isAdmin ? Shield : ArrowRightLeft;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon className="h-5 w-5 text-primary" />
            {isAdmin ? 'Admin Invitation' : 'Ownership Transfer'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {invitation.status !== 'pending' ? (
            <p className="text-sm text-muted-foreground">
              This invitation has already been {invitation.status}.
            </p>
          ) : (
            <>
              <p className="text-sm text-foreground">
                <strong>{inviterName}</strong> has invited you to {isAdmin ? 'become an admin of' : 'take ownership of'}{' '}
                <strong>"{circleName}"</strong>.
              </p>
              {!isAdmin && (
                <p className="text-xs text-muted-foreground">
                  Accepting will make you the owner. The current owner will be removed from the circle.
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleRespond(false)}
                  disabled={loading}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleRespond(true)}
                  disabled={loading}
                >
                  {loading && <SerkleLoader size="xs" className="text-current mr-1" />}
                  Accept
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CircleInvitationModal;
