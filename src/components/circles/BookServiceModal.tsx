import { purchaseCircleBooking } from '@/lib/circlePayments';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Clock, Coins, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useCoinWallet } from '@/hooks/useCoinWallet';
import { useUser } from '@/contexts/UserContext';

interface BookServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: {
    id: string;
    title: string;
    description: string;
    price: number;
    duration_minutes: number;
    category: string;
  };
  onSuccess: () => void;
}

const BookServiceModal: React.FC<BookServiceModalProps> = ({
  isOpen,
  onClose,
  service,
  onSuccess,
}) => {
  const { toast } = useToast();
  const { user } = useUser();
  const { balance } = useCoinWallet(user?.id);
  const submitting = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const hasEnoughCoins = balance >= service.price;
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    time: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    
    if (!selectedDate) {
      toast({
        title: 'Error',
        description: 'Please select a date',
        variant: 'destructive',
      });
      return;
    }

    submitting.current = true;
    setIsLoading(true);

    try {
      await purchaseCircleBooking('service', service.id, service.price, {
        booking_date: format(selectedDate, 'yyyy-MM-dd'), booking_time: formData.time,
        member_name: formData.name, member_email: formData.email, member_phone: formData.phone, notes: formData.notes,
      });

      toast({
        title: 'Success',
        description: 'Service booking request submitted successfully',
      });

      setFormData({
        name: '',
        email: '',
        phone: '',
        time: '',
        notes: '',
      });
      setSelectedDate(undefined);
      
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book Service: {service.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">{service.title}</h3>
            <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Coins className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">{service.price} coins</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{service.duration_minutes} min</span>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <span>Your balance: {balance} coins</span>
            </div>
            {!hasEnoughCoins && service.price > 0 && (
              <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                <AlertCircle className="w-3 h-3" />
                Insufficient coins
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Select Date *</Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>

            <div>
              <Label htmlFor="time">Preferred Time *</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
            </div>

            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any specific requirements or questions..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || (!hasEnoughCoins && service.price > 0)}>
                {isLoading && <SerkleLoader size="xs" className="text-current mr-2" />}
                Book ({service.price} coins)
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookServiceModal;
