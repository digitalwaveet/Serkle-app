import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEventMutations } from '@/hooks/useEventMutations';
import { InlineVideoLoader } from '@/components/ui/VideoLoader';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  circleId: string;
  userId: string;
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({ isOpen, onClose, circleId, userId }) => {
  const { createEvent, isCreating } = useEventMutations();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    event_time: '',
    duration_minutes: 60,
    event_type: 'Workshop',
    platform: 'Zoom',
    meeting_url: '',
    max_attendees: '',
    price: '',
    timezone: 'UTC',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const eventData = {
      circle_id: circleId,
      title: formData.title,
      description: formData.description,
      event_date: formData.event_date,
      event_time: formData.event_time,
      duration_minutes: formData.duration_minutes,
      event_type: formData.event_type,
      platform: formData.platform,
      meeting_url: formData.meeting_url || undefined,
      max_attendees: formData.max_attendees ? parseInt(formData.max_attendees) : undefined,
      price: formData.price ? parseFloat(formData.price) : 0,
      timezone: formData.timezone,
    };

    try {
      await createEvent(eventData, userId);
      onClose();
      setFormData({
        title: '',
        description: '',
        event_date: '',
        event_time: '',
        duration_minutes: 60,
        event_type: 'Workshop',
        platform: 'Zoom',
        meeting_url: '',
        max_attendees: '',
        price: '',
        timezone: 'UTC',
      });
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="event_date">Event Date *</Label>
              <Input
                id="event_date"
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="event_time">Event Time *</Label>
              <Input
                id="event_time"
                type="time"
                value={formData.event_time}
                onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration">Duration (minutes) *</Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                required
                min="15"
                step="15"
              />
            </div>

            <div>
              <Label htmlFor="event_type">Event Type *</Label>
              <Select value={formData.event_type} onValueChange={(value) => setFormData({ ...formData, event_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Workshop">Workshop</SelectItem>
                  <SelectItem value="Q&A">Q&A</SelectItem>
                  <SelectItem value="Networking">Networking</SelectItem>
                  <SelectItem value="Webinar">Webinar</SelectItem>
                  <SelectItem value="Training">Training</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="platform">Platform *</Label>
              <Select value={formData.platform} onValueChange={(value) => setFormData({ ...formData, platform: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Zoom">Zoom</SelectItem>
                  <SelectItem value="Google Meet">Google Meet</SelectItem>
                  <SelectItem value="Teams">Microsoft Teams</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="max_attendees">Max Attendees</Label>
              <Input
                id="max_attendees"
                type="number"
                value={formData.max_attendees}
                onChange={(e) => setFormData({ ...formData, max_attendees: e.target.value })}
                placeholder="Unlimited"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="meeting_url">Meeting URL</Label>
            <Input
              id="meeting_url"
              type="url"
              value={formData.meeting_url}
              onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
              placeholder="https://zoom.us/j/..."
            />
          </div>

          <div>
            <Label htmlFor="price">Price ($)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00 (Free event)"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating && <InlineVideoLoader className="mr-2" />}
              Create Event
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateEventModal;
