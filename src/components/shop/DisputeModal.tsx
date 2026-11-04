import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDisputes } from "@/hooks/useDisputes";


interface DisputeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  sellerId: string;
}

export const DisputeModal = ({ open, onOpenChange, orderId, sellerId }: DisputeModalProps) => {
  const { createDispute } = useDisputes();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!reason || !description) return;

    await createDispute.mutateAsync({
      orderId,
      sellerId,
      reason,
      description,
    });
    
    onOpenChange(false);
    setReason("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a Dispute</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Reason for Dispute</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_received">Item not received</SelectItem>
                <SelectItem value="wrong_item">Wrong item received</SelectItem>
                <SelectItem value="damaged">Item damaged</SelectItem>
                <SelectItem value="not_as_described">Not as described</SelectItem>
                <SelectItem value="quality_issues">Quality issues</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide details about your issue..."
              rows={4}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createDispute.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createDispute.isPending || !reason || !description}
              className="flex-1"
            >
              {createDispute.isPending && (
                <SerkleLoader size="xs" className="text-current mr-2" />
              )}
              Submit Dispute
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
