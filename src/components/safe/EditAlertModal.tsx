import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Edit, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface EditAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  alertId: string;
  currentDescription: string;
  currentUrgency: string;
}

export const EditAlertModal: React.FC<EditAlertModalProps> = ({
  isOpen,
  onClose,
  alertId,
  currentDescription,
  currentUrgency,
}) => {
  const [description, setDescription] = useState(currentDescription);
  const [urgency, setUrgency] = useState(currentUrgency);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setDescription(currentDescription);
    setUrgency(currentUrgency);
  }, [currentDescription, currentUrgency, isOpen]);

  const urgencyLevels = [
    { value: 'low', label: 'Low', color: 'bg-amber-500' },
    { value: 'medium', label: 'Medium', color: 'bg-orange-500' },
    { value: 'high', label: 'High', color: 'bg-red-500' },
  ];

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Description cannot be empty');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('sos_alerts')
        .update({
          description: description.trim(),
          urgency,
        })
        .eq('id', alertId);

      if (error) throw error;

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });

      // Notify helpers about the update
      await supabase.functions.invoke('send-push-notification', {
        body: {
          title: 'Alert Updated',
          body: 'An alert you are responding to has been updated',
          notificationType: 'alert_update',
          data: {
            alertId,
          },
        },
      });

      toast.success('Alert updated successfully');
      onClose();
    } catch (error: any) {
      console.error('Failed to update alert:', error);
      toast.error(error.message || 'Failed to update alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Alert
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              Helpers responding to your alert will be notified of any changes you make.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Urgency Level</Label>
            <div className="flex gap-2">
              {urgencyLevels.map((level) => (
                <Button
                  key={level.value}
                  type="button"
                  variant={urgency === level.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUrgency(level.value)}
                  className={urgency === level.value ? level.color : ''}
                >
                  {level.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              placeholder="Update your alert description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500 characters
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900">
              Make sure your update is accurate. Misleading information may confuse helpers.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!description.trim() || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Updating...' : 'Update Alert'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
