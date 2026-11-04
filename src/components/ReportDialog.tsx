import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Flag } from 'lucide-react';

export type ReportReason = 'Spam' | 'Inappropriate Content' | 'Harassment or Bullying' | 'Hate Speech' | 'Other';

const REPORT_REASONS: ReportReason[] = [
  'Spam',
  'Inappropriate Content',
  'Harassment or Bullying',
  'Hate Speech',
  'Other'
];

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => void;
  itemType?: string;
}

export const ReportDialog: React.FC<ReportDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  itemType = 'content'
}) => {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setDetails('');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!reason) return;
    onSubmit(reason, details);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Flag className="w-5 h-5" />
            Report {itemType}
          </DialogTitle>
          <DialogDescription>
            Please tell us why you are reporting this {itemType}. Your report will be kept anonymous.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <RadioGroup value={reason} onValueChange={(val) => setReason(val as ReportReason)} className="flex flex-col gap-3">
            {REPORT_REASONS.map((r) => (
              <div key={r} className="flex items-center space-x-2">
                <RadioGroupItem value={r} id={`reason-${r}`} />
                <Label htmlFor={`reason-${r}`} className="text-sm font-medium cursor-pointer">
                  {r}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {reason === 'Other' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label htmlFor="details">Additional Details</Label>
              <Textarea
                id="details"
                placeholder="Please provide more information..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="resize-none h-24"
              />
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleSubmit}
            disabled={!reason || (reason === 'Other' && details.trim() === '')}
          >
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
