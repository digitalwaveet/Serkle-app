import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, Link2 } from 'lucide-react';
import { toast } from 'sonner';

interface InviteLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inviteCode: string;
  circleName: string;
}

const InviteLinkModal: React.FC<InviteLinkModalProps> = ({ open, onOpenChange, inviteCode, circleName }) => {
  const [copied, setCopied] = useState(false);

  const publishedDomain = 'https://heart-lens-studio.lovable.app';
  const inviteLink = `${publishedDomain}/join/${inviteCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Invite Link
          </DialogTitle>
          <DialogDescription>
            Share this link to invite people to <span className="font-semibold">{circleName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Input
              value={inviteLink}
              readOnly
              className="text-sm font-mono bg-muted"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Anyone with this link can join your circle
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteLinkModal;
