import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { InlineVideoLoader } from '@/components/ui/VideoLoader';

interface CreateServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  circleId: string;
  onSuccess: () => void;
}

const CreateServiceModal: React.FC<CreateServiceModalProps> = ({
  isOpen,
  onClose,
  circleId,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    duration_minutes: '',
    category: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('circle_services').insert({
        circle_id: circleId,
        provider_id: user.id,
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        duration_minutes: parseInt(formData.duration_minutes),
        category: formData.category,
        is_active: true,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Service created successfully',
      });

      setFormData({
        title: '',
        description: '',
        price: '',
        duration_minutes: '',
        category: '',
      });
      
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Service</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Service Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Strategy Consultation"
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Consulting">Consulting</SelectItem>
                <SelectItem value="Workshop">Workshop</SelectItem>
                <SelectItem value="Review">Review</SelectItem>
                <SelectItem value="Coaching">Coaching</SelectItem>
                <SelectItem value="Training">Training</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your service in detail..."
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Price (USD) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="99.00"
                required
              />
            </div>

            <div>
              <Label htmlFor="duration">Duration (minutes) *</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                step="15"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                placeholder="60"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <InlineVideoLoader className="mr-2" />}
              Create Service
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateServiceModal;
