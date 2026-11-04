import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { formatCircleCount } from '@/lib/circleCountFormat';
import { supabase } from '@/integrations/supabase/client';


interface EventAttendeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
}

const EventAttendeesModal: React.FC<EventAttendeesModalProps> = ({ 
  isOpen, 
  onClose, 
  eventId,
  eventTitle 
}) => {
  const { data: attendees, isLoading } = useQuery({
    queryKey: ['event-attendees', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('circle_event_attendees')
        .select(`
          *,
          profiles:user_id (
            id,
            name,
            username,
            avatar_url,
            initials,
            avatar_color
          )
        `)
        .eq('event_id', eventId)
        .order('registered_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Event Attendees - {eventTitle}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <SerkleLoader size="md" className="text-current" />
          </div>
        ) : attendees && attendees.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {formatCircleCount(attendees.length, 'attendee')}
            </p>
            {attendees.map((attendee: any) => (
              <div 
                key={attendee.id} 
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={attendee.profiles?.avatar_url} />
                    <AvatarFallback style={{ backgroundColor: attendee.profiles?.avatar_color }}>
                      {attendee.profiles?.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{attendee.profiles?.name}</p>
                    <p className="text-sm text-muted-foreground">@{attendee.profiles?.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={attendee.status === 'registered' ? 'default' : 'secondary'}>
                    {attendee.status}
                  </Badge>
                  {attendee.payment_status !== 'free' && (
                    <Badge variant={attendee.payment_status === 'paid' ? 'default' : 'outline'}>
                      {attendee.payment_status}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No attendees yet
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EventAttendeesModal;
