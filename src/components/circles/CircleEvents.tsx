import { useUser } from '@/contexts/UserContext';
import { signProtectedMedia } from '@/lib/protectedMedia';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { Calendar, Clock, Users, Video, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEventMutations } from '@/hooks/useEventMutations';
import CreateEventModal from './CreateEventModal';
import EventAttendeesModal from './EventAttendeesModal';
import CircleEmptyState from './CircleEmptyState';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CustomFilePicker } from '@/components/CustomFilePicker';
import { formatCircleCount } from '@/lib/circleCountFormat';

interface CircleEventsProps {
  circle: any;
  isOwner: boolean;
}

const CircleEvents: React.FC<CircleEventsProps> = ({ circle, isOwner }) => {
  const { user: currentUser } = useUser();
  const [filter, setFilter] = useState('upcoming');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEventForAttendees, setSelectedEventForAttendees] = useState<any>(null);
  const [uploadingEventId, setUploadingEventId] = useState<string | null>(null);
  
  const { registerForEvent, cancelRegistration, uploadRecording, isRegistering, isUploadingRecording } = useEventMutations();

  const { data: events, isLoading } = useQuery({
    queryKey: ['circle-events', circle.id, currentUser?.id],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_circle_events' as any, { _circle_id: circle.id });
      if (error) throw error;
      return signProtectedMedia((data || []) as any[]);
    },
  });

  const { data: userSession } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const filteredEvents = events?.filter(event => event.status === filter) || [];

  const isUserRegistered = (event: any) => {
    return event.circle_event_attendees?.some((a: any) => a.user_id === userSession?.user?.id);
  };

  const handleRegister = async (event: any) => {
    if (!userSession?.user?.id) return;
    try {
      await registerForEvent(event.id, userSession.user.id, Number(event.price || 0));
    } catch (error) {
      console.error('Error registering for event:', error);
    }
  };

  const handleCancelRegistration = async (event: any) => {
    if (!userSession?.user?.id) return;
    try {
      await cancelRegistration(event.id, userSession.user.id);
    } catch (error) {
      console.error('Error cancelling registration:', error);
    }
  };

  const handleRecordingUpload = async (eventId: string, file: File) => {
    setUploadingEventId(eventId);
    try {
      await uploadRecording(eventId, file);
    } catch (error) {
      console.error('Error uploading recording:', error);
    } finally {
      setUploadingEventId(null);
    }
  };

  const downloadCalendarEvent = (event: any) => {
    const startDate = new Date(`${event.event_date}T${event.event_time}`);
    const endDate = new Date(startDate.getTime() + event.duration_minutes * 60000);
    
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description}${event.meeting_url ? '\\n\\nJoin: ' + event.meeting_url : ''}`,
      `LOCATION:${event.platform}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Events</h3>
        {isOwner && (
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create Event
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <SerkleLoader size="md" className="text-current" />
        </div>
      ) : (
        <>
          <Tabs value={filter} onValueChange={setFilter} className="mb-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-4 mt-4">
              {filteredEvents.length === 0 ? (
                <CircleEmptyState
                  icon={Calendar}
                  title="No Events Yet"
                  description="Host workshops, Q&A sessions, or meetups."
                  ownerTitle="Host your first event"
                  ownerDescription="Schedule a workshop, Q&A or meetup for your members."
                  isOwner={isOwner}
                  actionLabel="Create Event"
                  onAction={() => setIsCreateModalOpen(true)}
                />
              ) : (
                filteredEvents.map((event) => {
                  const registered = isUserRegistered(event);
                  return (
                    <Card key={event.id} className="hover:shadow-md transition-shadow mx-0">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-lg">{event.title}</CardTitle>
                              <Badge variant="outline">{event.event_type}</Badge>
                              {event.price > 0 && <Badge variant="default">${event.price}</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{event.description}</p>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>{event.event_date}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{event.event_time}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Video className="h-4 w-4 text-muted-foreground" />
                                <span>{event.platform}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span>{event.circle_event_attendees?.length || 0}{event.max_attendees ? `/${event.max_attendees}` : ''}</span>
                              </div>
                            </div>
                            {event.meeting_url && (
                              <a 
                                href={event.meeting_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline mt-2 block"
                              >
                                Join Meeting →
                              </a>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-2">
                          {isOwner ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedEventForAttendees(event)}
                            >
                              View {formatCircleCount(event.circle_event_attendees?.length || 0, 'attendee')}
                            </Button>
                          ) : registered ? (
                            <>
                              <Badge variant="default" className="mr-2">Registered</Badge>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleCancelRegistration(event)}
                                disabled={isRegistering}
                              >
                                Cancel Registration
                              </Button>
                            </>
                          ) : (
                            <Button 
                              size="sm" 
                              onClick={() => handleRegister(event)}
                              disabled={isRegistering}
                            >
                              {isRegistering && <SerkleLoader size="xs" className="text-current mr-2" />}
                              {event.price > 0 ? `Register & Pay (${event.price} coins)` : 'Join Event'}
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => downloadCalendarEvent(event)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Add to Calendar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4 mt-4">
              {filteredEvents.length === 0 ? (
                <CircleEmptyState
                  icon={Calendar}
                  title="No past events"
                  description="Completed events and recordings will show up here."
                  ownerTitle="No past events"
                  ownerDescription="Completed events and recordings will show up here."
                  isOwner={isOwner}
                />
              ) : (
                filteredEvents.map((event) => (
                  <Card key={event.id} className="opacity-75 mx-0">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-2">{event.title}</CardTitle>
                          <p className="text-sm text-muted-foreground mb-3">{event.description}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{event.event_date}</span>
                            <span>{formatCircleCount(event.circle_event_attendees?.length || 0, 'attendee')} attended</span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      {event.recording_url ? (
                        <div className="space-y-2">
                          <video 
                            controls 
                            className="w-full rounded-lg"
                            src={event.recording_url}
                          />
                        </div>
                      ) : isOwner ? (
                        <div className="flex items-center gap-2">
                          <CustomFilePicker
                            accept="video/*"
                            onUpload={async (file) => handleRecordingUpload(event.id, file as File)}
                            hidePreviewList
                          >
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={uploadingEventId === event.id}
                            >
                              {uploadingEventId === event.id ? (
                                <>
                                  <SerkleLoader size="xs" className="text-current mr-2" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-1" />
                                  Upload Recording
                                </>
                              )}
                            </Button>
                          </CustomFilePicker>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No recording available</p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {isOwner && (
        <>
          <CreateEventModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            circleId={circle.id}
            userId={userSession?.user?.id || ''}
          />
          
          {selectedEventForAttendees && (
            <EventAttendeesModal
              isOpen={!!selectedEventForAttendees}
              onClose={() => setSelectedEventForAttendees(null)}
              eventId={selectedEventForAttendees.id}
              eventTitle={selectedEventForAttendees.title}
            />
          )}
        </>
      )}

    </div>
  );
};

export default CircleEvents;
