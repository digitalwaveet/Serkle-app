import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, Mail, Phone, User, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ServiceBookingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  serviceName: string;
}

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  member_name: string;
  member_email: string;
  member_phone: string | null;
  notes: string | null;
  status: string;
  payment_status: string;
  created_at: string;
}

const ServiceBookingsModal: React.FC<ServiceBookingsModalProps> = ({
  isOpen,
  onClose,
  serviceId,
  serviceName,
}) => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchBookings();
    }
  }, [isOpen, serviceId]);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('circle_service_bookings')
        .select('*')
        .eq('service_id', serviceId)
        .order('booking_date', { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load bookings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('circle_service_bookings')
        .update({ status })
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Booking ${status}`,
      });

      fetchBookings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      confirmed: 'default',
      completed: 'outline',
      cancelled: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bookings for {serviceName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <SerkleLoader size="md" className="text-primary" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No bookings yet
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <h4 className="font-semibold">{booking.member_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Booked on {format(new Date(booking.created_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(booking.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(booking.booking_date), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{booking.booking_time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{booking.member_email}</span>
                  </div>
                  {booking.member_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{booking.member_phone}</span>
                    </div>
                  )}
                </div>

                {booking.notes && (
                  <div className="bg-muted p-3 rounded text-sm">
                    <p className="font-medium mb-1">Notes:</p>
                    <p className="text-muted-foreground">{booking.notes}</p>
                  </div>
                )}

                {booking.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                )}

                {booking.status === 'confirmed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateBookingStatus(booking.id, 'completed')}
                    className="w-full"
                  >
                    Mark as Completed
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ServiceBookingsModal;
