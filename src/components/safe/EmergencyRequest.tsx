import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, MapPin, Phone, Clock, Camera } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSOSAlerts } from '@/hooks/useSOSAlerts';
import { useGeolocation } from '@/hooks/useGeolocation';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { CustomFilePicker, useFileManager } from '@/components/CustomFilePicker';

const EMERGENCY_TYPES = [
  { id: 'medical', label: 'Medical Emergency', color: 'bg-red-100 text-red-800 border-red-200' },
  { id: 'safety', label: 'Personal Safety', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'fire', label: 'Fire/Hazard', color: 'bg-red-100 text-red-800 border-red-200' },
  { id: 'accident', label: 'Accident', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { id: 'natural', label: 'Natural Disaster', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'other', label: 'Other Emergency', color: 'bg-muted/50 text-foreground border-border' },
];

export const EmergencyRequest: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string>('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const photoManager = useFileManager();
  const photos = photoManager.files.map(f => f.url);
  const [isUploading, setIsUploading] = useState(false);
  
  const { createAlert, updateAlertLocation } = useSOSAlerts();
  const { latitude, longitude } = useGeolocation();
  const { user } = useUser();

  // Update location every 10 seconds if live tracking is enabled
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: alerts } = await supabase
          .from('sos_alerts')
          .select('id, share_live_location')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .single();

        if (alerts?.share_live_location && latitude && longitude) {
          const intervalId = setInterval(() => {
            updateAlertLocation(alerts.id, latitude, longitude);
          }, 10000);

          return () => clearInterval(intervalId);
        }
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [latitude, longitude, updateAlertLocation]);

  const handleSubmit = async () => {
    if (!selectedType || !description) {
      toast.error('Please select emergency type and provide description');
      return;
    }

    if (!latitude || !longitude) {
      toast.error('Location access required. Please enable location services.');
      return;
    }

    try {
      await createAlert.mutateAsync({
        sos_type: selectedType,
        description,
        urgency,
        location_lat: latitude,
        location_lng: longitude,
        share_live_location: true,
        photo_urls: (photoManager.files.filter(f => f.status === 'done').map(f => f.id).length > 0) 
          ? photoManager.files.filter(f => f.status === 'done').map(f => f.url) 
          : undefined, // Note: The original code used URL, but usually we'd want storage paths. For now keeping original logic.
      });

      // Reset form
      setSelectedType('');
      setDescription('');
      photoManager.clearAll();
      
      toast.success('Emergency alert sent! Nearby helpers have been notified.');
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  };

  const handleUpload = async (file: File | Blob) => {
    if (!user) throw new Error('Not authenticated');
    
    const fileExt = (file as File).name?.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('sos-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('sos-photos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  // Native handlePhotoUpload and removePhoto replaced by photoManager state and CustomFilePicker props

  return (
    <div className="px-4 space-y-6">
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          For life-threatening emergencies, call 911 immediately
        </AlertDescription>
      </Alert>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Request Emergency Help</h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-3 block">Emergency Type</label>
            <div className="grid grid-cols-2 gap-2">
              {EMERGENCY_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    selectedType === type.id 
                      ? type.color 
                      : 'bg-card border-border text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="description" className="text-sm font-medium text-foreground mb-2 block">
              Describe the situation
            </label>
            <Textarea
              id="description"
              placeholder="Please provide details about what's happening..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Photo Upload handled by CustomFilePicker preview */}

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Share Location
            </Button>
            <CustomFilePicker
              manager={photoManager}
              onUpload={handleUpload}
              multiple
              hideUploadButton
              accept="image/*"
              maxFileSizeMB={10}
            >
              <Button 
                variant="outline" 
                className="flex items-center gap-2 relative w-full"
                disabled={photoManager.files.length >= 3 || isUploading}
              >
                <Camera className="h-4 w-4" />
                {isUploading ? <><SerkleLoader size="xs" className="text-current" /> Uploading...</> : 'Add Photo'}
              </Button>
            </CustomFilePicker>
          </div>

          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <MapPin className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-800">
              Location sharing enabled - helpers can find you
            </span>
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg mb-3">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-800">
              {latitude && longitude ? 
                `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : 
                'Getting your location...'
              }
            </span>
          </div>

          <Button 
            onClick={handleSubmit}
            disabled={!selectedType || !description || !latitude || !longitude || createAlert.isPending}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {createAlert.isPending ? (
              <div className="flex items-center gap-2">
                <SerkleLoader size="xs" className="text-current object-contain" />
                Sending Help Request...
              </div>
            ) : (
              'Send Emergency Request'
            )}
          </Button>
        </div>
      </Card>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <h3 className="font-medium text-blue-900 mb-2">Quick Emergency Contacts</h3>
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start text-blue-800 border-blue-300">
            <Phone className="h-4 w-4 mr-2" />
            Emergency Services - 911
          </Button>
          <Button variant="outline" className="w-full justify-start text-blue-800 border-blue-300">
            <Phone className="h-4 w-4 mr-2" />
            Poison Control - 1-800-222-1222
          </Button>
        </div>
      </Card>
    </div>
  );
};
