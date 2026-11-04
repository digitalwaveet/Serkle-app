import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoorOpen, Trash2, ArrowRightLeft, ShieldPlus, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Circle } from '@/hooks/useCircles';
import { useCircleMutations } from '@/hooks/useCircleMutations';
import { useSendCircleInvitation } from '@/hooks/useCircleInvitations';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import FriendPicker from './FriendPicker';
import { formatCircleCount } from '@/lib/circleCountFormat';
import { CIRCLE_OWNER_EXIT_POLICY } from '@/lib/circleLeave';

interface CircleManageModalProps {
  circle: Circle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SelectedFriend {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  initials: string;
  avatar_color: string;
}

type ModalView = 'menu' | 'transfer' | 'transfer-confirm' | 'admin';

const CircleManageModal: React.FC<CircleManageModalProps> = ({ circle, open, onOpenChange }) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { deleteCircle } = useCircleMutations();
  const { sendInvitation } = useSendCircleInvitation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [view, setView] = useState<ModalView>('menu');
  const [selectedFriends, setSelectedFriends] = useState<SelectedFriend[]>([]);
  const [sending, setSending] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleOpen = () => {
    onOpenChange(false);
    navigate(`/circle/${circle.id}`);
  };

  const handleDelete = async () => {
    if (!user?.id) return;
    try {
      await deleteCircle(circle.id, user.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch {}
  };

  const handleSendAdminInvites = async () => {
    if (!user?.id || selectedFriends.length === 0) return;
    setSending(true);
    await sendInvitation(
      circle.id,
      circle.name,
      user.id,
      selectedFriends.map(f => f.id),
      'admin'
    );
    setSending(false);
    setSelectedFriends([]);
    setView('menu');
    onOpenChange(false);
  };

  const handleTransferNext = () => {
    if (selectedFriends.length === 0) return;
    setPassword('');
    setPasswordError('');
    setView('transfer-confirm');
  };

  const handleVerifyAndTransfer = async () => {
    if (!user?.id || !password.trim()) {
      setPasswordError('Please enter your password');
      return;
    }

    setVerifying(true);
    setPasswordError('');

    try {
      // Re-authenticate the user with their password
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email;

      if (!email) {
        setPasswordError('Unable to verify account. Please try again.');
        setVerifying(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: password.trim(),
      });

      if (error) {
        setPasswordError('Incorrect password. Please try again.');
        setVerifying(false);
        return;
      }

      // Password verified — now send the transfer invitation
      setSending(true);
      await sendInvitation(
        circle.id,
        circle.name,
        user.id,
        [selectedFriends[0].id],
        'transfer_ownership'
      );
      setSending(false);
      setPassword('');
      setSelectedFriends([]);
      setView('menu');
      onOpenChange(false);
    } catch (err: any) {
      setPasswordError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const resetView = () => {
    setView('menu');
    setSelectedFriends([]);
    setPassword('');
    setPasswordError('');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetView(); }}>
        <DialogContent className="max-w-[340px] rounded-2xl p-0 overflow-hidden">
          {view === 'menu' && (
            <>
              <DialogHeader className="p-4 pb-2">
                <DialogTitle className="text-base font-semibold text-foreground">Manage Circle</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-1 p-2">
                <p className="px-3 pb-2 text-xs text-muted-foreground">{CIRCLE_OWNER_EXIT_POLICY}</p>
                <button
                  onClick={handleOpen}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left w-full"
                >
                  <DoorOpen className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Open Circle</p>
                    <p className="text-xs text-muted-foreground">Enter your circle page</p>
                  </div>
                </button>

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-destructive/10 transition-colors text-left w-full"
                >
                  <Trash2 className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Delete Circle</p>
                    <p className="text-xs text-muted-foreground">Permanently remove this circle</p>
                  </div>
                </button>

                <button
                  onClick={() => { setSelectedFriends([]); setView('transfer'); }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left w-full"
                >
                  <ArrowRightLeft className="h-5 w-5 text-secondary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Transfer Ownership</p>
                    <p className="text-xs text-muted-foreground">Transfer first, then choose whether to leave</p>
                  </div>
                </button>

                <button
                  onClick={() => { setSelectedFriends([]); setView('admin'); }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left w-full"
                >
                  <ShieldPlus className="h-5 w-5 text-accent-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Add Admin</p>
                    <p className="text-xs text-muted-foreground">Invite friends to co-manage</p>
                  </div>
                </button>
              </div>
              <div className="h-2" />
            </>
          )}

          {view === 'transfer' && (
            <>
              <DialogHeader className="p-4 pb-2">
                <DialogTitle className="text-base font-semibold text-foreground">Transfer Ownership</DialogTitle>
              </DialogHeader>
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Select a friend to become the new owner. After they accept, you will remain a member and can choose Leave Circle.
                </p>
                <FriendPicker
                  multiSelect={false}
                  selected={selectedFriends}
                  onSelect={setSelectedFriends}
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setView('menu')}>
                    Back
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleTransferNext}
                    disabled={selectedFriends.length === 0}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}

          {view === 'transfer-confirm' && (
            <>
              <DialogHeader className="p-4 pb-2">
                <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  Confirm Your Identity
                </DialogTitle>
              </DialogHeader>
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  For security, enter your account password to confirm the ownership transfer to <span className="font-semibold text-foreground">{selectedFriends[0]?.name}</span>.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="transfer-password" className="text-sm">Password</Label>
                  <Input
                    id="transfer-password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyAndTransfer(); }}
                    className={passwordError ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {passwordError && (
                    <p className="text-xs text-destructive">{passwordError}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setView('transfer')}>
                    Back
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleVerifyAndTransfer}
                    disabled={!password.trim() || verifying || sending}
                  >
                    {(verifying || sending) && <SerkleLoader size="xs" className="text-current mr-1" />}
                    {verifying ? 'Verifying...' : sending ? 'Sending...' : 'Confirm & Send'}
                  </Button>
                </div>
              </div>
            </>
          )}

          {view === 'admin' && (
            <>
              <DialogHeader className="p-4 pb-2">
                <DialogTitle className="text-base font-semibold text-foreground">Add Admin</DialogTitle>
              </DialogHeader>
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Select friends to help manage this circle alongside you.
                </p>
                <FriendPicker
                  multiSelect={true}
                  selected={selectedFriends}
                  onSelect={setSelectedFriends}
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setView('menu')}>
                    Back
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleSendAdminInvites}
                    disabled={selectedFriends.length === 0 || sending}
                  >
                    {sending && <SerkleLoader size="xs" className="text-current mr-1" />}
                    Send {selectedFriends.length > 0 ? formatCircleCount(selectedFriends.length, 'invite') : 'Invite'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{circle.name}</strong> and all its content. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Circle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CircleManageModal;
