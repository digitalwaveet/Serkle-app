import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Flag, AlertTriangle } from 'lucide-react';
import { useAbuseReport } from '@/hooks/useAbuseReport';

interface AbuseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  alertId?: string;
  reportedUserId?: string;
}

const reportTypes = [
  { value: 'false_alert', label: 'False or Fake Alert', description: 'Alert was not a real emergency' },
  { value: 'harassment', label: 'Harassment', description: 'Abusive or threatening behavior' },
  { value: 'inappropriate_content', label: 'Inappropriate Content', description: 'Offensive or explicit content' },
  { value: 'spam', label: 'Spam', description: 'Repeated or irrelevant alerts' },
  { value: 'other', label: 'Other', description: 'Other violation' },
];

export const AbuseReportModal: React.FC<AbuseReportModalProps> = ({
  isOpen,
  onClose,
  alertId,
  reportedUserId,
}) => {
  const [reportType, setReportType] = useState<string>('false_alert');
  const [description, setDescription] = useState('');
  const { submitReport } = useAbuseReport();

  const handleSubmit = () => {
    if (!description.trim()) {
      return;
    }

    submitReport.mutate(
      {
        alert_id: alertId,
        reported_user_id: reportedUserId,
        report_type: reportType as any,
        description: description.trim(),
      },
      {
        onSuccess: () => {
          setDescription('');
          setReportType('false_alert');
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Flag className="h-5 w-5" />
            Report Abuse
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900">
              False reports may result in account suspension. Only report genuine violations.
            </p>
          </div>

          <div className="space-y-3">
            <Label>What type of violation is this?</Label>
            <RadioGroup value={reportType} onValueChange={setReportType}>
              {reportTypes.map((type) => (
                <div key={type.value} className="flex items-start space-x-3">
                  <RadioGroupItem value={type.value} id={type.value} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={type.value} className="font-medium cursor-pointer">
                      {type.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Describe the issue *</Label>
            <Textarea
              placeholder="Please provide details about the violation..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500 characters
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!description.trim() || submitReport.isPending}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            {submitReport.isPending ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
