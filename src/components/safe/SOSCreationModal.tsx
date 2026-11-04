import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, MapPin, Phone, Share2, Camera, Send, X, Heart, Shield, Search, Siren, Clock, Target, Users, User, Timer, AlertCircle, Baby, Bandage, Stethoscope, Home, Eye, UserX, Flame, Cloud, Car, Info } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useSOSAlerts } from '@/hooks/useSOSAlerts';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { compressImage, formatFileSize, getCompressionRatio } from '@/utils/imageCompression';
import { LocationPrivacyModal } from './LocationPrivacyModal';
import { CustomFilePicker, useFileManager } from '@/components/CustomFilePicker';

interface SOSCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sosType: string;
  subCategory?: string;
}

export const SOSCreationModal: React.FC<SOSCreationModalProps> = ({
  isOpen,
  onClose,
  sosType,
  subCategory
}) => {
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('high');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [shareLocation, setShareLocation] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Category-specific fields
  const [personAge, setPersonAge] = useState('');
  const [personDescription, setPersonDescription] = useState('');
  const [lastSeen, setLastSeen] = useState('');
  const [injuryType, setInjuryType] = useState('');
  const [consciousLevel, setConsciousLevel] = useState('');
  const [threatActive, setThreatActive] = useState(false);
  const sosFileManager = useFileManager();
  const photos = sosFileManager.files.map(f => f.url);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [alertRadius, setAlertRadius] = useState(5); // km
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const { triggerHaptic } = useHapticFeedback();
  const { latitude, longitude, refreshLocation } = useGeolocation();
  const { createAlert } = useSOSAlerts();
  const { user } = useUser();

  const urgencyLevels = [
    { 
      value: 'low', 
      label: 'Low', 
      color: 'bg-amber-500', 
      description: 'Non-urgent assistance needed',
      icon: Clock
    },
    { 
      value: 'medium', 
      label: 'Medium', 
      color: 'bg-orange-500', 
      description: 'Moderate urgency',
      icon: AlertTriangle
    },
    { 
      value: 'high', 
      label: 'High', 
      color: 'bg-red-500', 
      description: 'Immediate attention required',
      icon: Siren
    }
  ];

  const sosTypes = {
    medical: { icon: Heart, label: 'Medical Emergency', color: 'text-red-600' },
    safety: { icon: Shield, label: 'Safety Alert', color: 'text-orange-600' },
    lost: { icon: Search, label: 'Lost Person', color: 'text-amber-600' },
    emergency: { icon: Siren, label: 'General Emergency', color: 'text-red-600' }
  };

  const currentType = sosTypes[sosType as keyof typeof sosTypes] || sosTypes.emergency;

  // Smart suggestions based on SOS type
  const getSuggestions = () => {
    switch (sosType) {
      case 'medical':
        return [
          'Chest pain or discomfort',
          'Difficulty breathing',
          'Severe headache',
          'Loss of consciousness',
          'Severe bleeding',
          'Broken bone suspected',
          'Allergic reaction',
          'Heart attack symptoms',
          'Stroke symptoms',
          'Severe abdominal pain',
          'Fall from height',
          'Car accident injuries',
          'Choking incident',
          'Diabetic emergency',
          'Overdose suspected'
        ];
      case 'lost':
        return [
          'Child missing from playground',
          'Elderly person with dementia',
          'Missing at shopping mall',
          'Lost while hiking',
          'Missing from school',
          'Wandered from home',
          'Lost at festival/event',
          'Missing from hospital',
          'Lost at beach/park',
          'Missing person has medical condition',
          'Person in wheelchair missing',
          'Missing with their pet',
          'Lost during family trip'
        ];
      case 'safety':
        return [
          'Suspicious person following me',
          'Domestic violence situation',
          'Threats being made',
          'Being harassed',
          'Unsafe building conditions',
          'Gas leak suspected',
          'Fire hazard present',
          'Aggressive animal',
          'Road accident blocking traffic',
          'Flooding in area',
          'Power lines down',
          'Chemical spill',
          'Violent behavior witnessed',
          'Unsafe workplace conditions'
        ];
      case 'emergency':
        return [
          'Natural disaster occurring',
          'Building collapse',
          'Multiple casualties',
          'Explosion heard',
          'Large fire spreading',
          'Severe weather emergency',
          'Bridge or road collapse',
          'Mass casualty incident',
          'Terrorist activity suspected',
          'Hazmat situation',
          'Evacuation needed',
          'Public safety threat',
          'Infrastructure failure'
        ];
      default:
        return [];
    }
  };

  const suggestions = getSuggestions();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(false);

  const insertSuggestion = (suggestion: string) => {
    const currentText = sosType === 'lost' ? personDescription : description;
    const newText = currentText ? `${currentText}. ${suggestion}` : suggestion;
    
    if (sosType === 'lost') {
      setPersonDescription(newText);
    } else {
      setDescription(newText);
    }
    setSelectedSuggestion(true);
    setShowSuggestions(false);
    triggerHaptic('light');
  };

  const handleTextareaFocus = () => {
    console.log('Textarea focused, showSuggestions will be:', !selectedSuggestion);
    if (!selectedSuggestion) {
      setShowSuggestions(true);
    }
  };

  const handleTextareaBlur = () => {
    console.log('Textarea blurred, hiding suggestions in 150ms');
    // Delay hiding to allow clicking on suggestions
    setTimeout(() => setShowSuggestions(false), 150);
  };

  const getRequiredFields = () => {
    switch (sosType) {
      case 'medical':
        return ['description'];
      case 'lost':
        return ['personDescription', 'lastSeen'];
      case 'safety':
        return ['description'];
      case 'emergency':
        return ['description'];
      default:
        return ['description'];
    }
  };

  const isFormValid = () => {
    const required = getRequiredFields();
    const values = {
      description,
      personDescription,
      lastSeen,
      injuryType,
      consciousLevel
    };
    
    return required.every(field => values[field as keyof typeof values]?.trim());
  };

  const checkRateLimit = async () => {
    if (!user) return false;
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('sos_alerts')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);
    
    if (error) {
      console.error('Rate limit check error:', error);
      return false;
    }
    
    return (data?.length || 0) >= 3;
  };

  const handleSubmit = async () => {
    if (!isFormValid()) return;
    
    // Show confirmation dialog first
    setShowConfirmDialog(true);
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirmDialog(false);
    
    // Check rate limit
    const isRateLimited = await checkRateLimit();
    if (isRateLimited) {
      toast.error('Rate limit exceeded. Maximum 3 alerts per hour.');
      return;
    }
    
    setIsSubmitting(true);
    triggerHaptic('success');
    
    try {
      const newAlert = await createAlert.mutateAsync({
      sos_type: sosType,
      sub_category: subCategory,
      urgency,
      description,
      location_lat: latitude,
      location_lng: longitude,
      location_address: location,
      share_live_location: shareLocation,
      person_age: personAge,
      person_description: personDescription,
      last_seen: lastSeen,
      injury_type: injuryType,
      conscious_level: consciousLevel,
      threat_active: threatActive,
      photo_urls: (sosFileManager.files.filter(f => f.status === 'done').length > 0) 
        ? sosFileManager.files.filter(f => f.status === 'done').map(f => f.url) 
        : undefined,
    });
    
    // Auto-notify emergency contacts
    try {
      await supabase.functions.invoke('notify-emergency-contacts', {
        body: {
          alert_id: newAlert.id,
          sos_type: sosType,
          urgency,
          description,
          location_lat: latitude,
          location_lng: longitude,
          location_address: location,
        },
      });
      console.log('Emergency contacts notified');
    } catch (error) {
      console.error('Failed to notify emergency contacts:', error);
    }
    
    // Notify nearby users
    try {
      await supabase.functions.invoke('notify-nearby-users', {
        body: {
          alert_id: newAlert.id,
          sos_type: sosType,
          urgency,
          description,
          location_lat: latitude,
          location_lng: longitude,
          location_address: location,
        },
      });
        toast.success('Alert broadcasted to all nearby users');
      } catch (error) {
        console.error('Failed to send notifications:', error);
        // Don't fail the alert creation if notifications fail
      }
      
      onClose();
      
      // Reset form
      setDescription('');
      setLocation('');
      setPersonAge('');
      setPersonDescription('');
      setLastSeen('');
      setInjuryType('');
      setConsciousLevel('');
      setUrgency('high');
      sosFileManager.clearAll();
    } catch (error: any) {
      console.error('Failed to create alert:', error);
      toast.error(error.message || 'Failed to create alert. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmergencyCall = () => {
    triggerHaptic('heavy');
    window.open('tel:911', '_self');
  };

  const handleUpload = async (file: File | Blob) => {
    if (!user) throw new Error('Not authenticated');
    
    // Compress image
    const { blob } = await compressImage(file as File, 1200, 0.8);
    
    const fileExt = (file as File).name?.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('sos-photos')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('sos-photos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const removePhoto = (index: number) => {
    // Replaced by sosFileManager
    triggerHaptic('light');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto" aria-describedby="sos-modal-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className={`p-2 rounded-lg ${currentType.color} bg-opacity-10`}>
              <currentType.icon className={`h-6 w-6 ${currentType.color}`} aria-hidden="true" />
            </div>
            {currentType.label}
          </DialogTitle>
        </DialogHeader>

        <p id="sos-modal-description" className="sr-only">
          Create a new SOS alert for {sosType} emergency. Fill out the form below to send an alert to nearby helpers.
        </p>

        <div className="space-y-4">
          {/* Warning Alert */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
              <div className="text-sm text-red-800 flex-1">
                <p className="font-medium">Emergency Alert</p>
                <p className="text-xs">This will notify nearby helpers immediately.</p>
              </div>
            </div>
            <button
              onClick={() => setShowPrivacyModal(true)}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1"
            >
              <Info className="h-3 w-3" />
              Who can see my location?
            </button>
          </div>

          {/* Category-specific forms */}
          {sosType === 'medical' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="injury">What happened? *</Label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Textarea
                        id="injury"
                        placeholder="Brief description (e.g., fell down stairs, chest pain, difficulty breathing)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onFocus={handleTextareaFocus}
                        rows={2}
                        className="resize-none pr-10"
                      />
                      <div className="absolute bottom-2 right-2">
                        <CustomFilePicker
                          manager={sosFileManager}
                          onUpload={handleUpload}
                          multiple
                          hideUploadButton
                          accept="image/*"
                          maxFileSizeMB={10}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 bg-primary/10 hover:bg-primary/20 rounded-lg cursor-pointer transition-colors"
                            disabled={sosFileManager.files.length >= 3 || isUploading}
                          >
                            <Camera className="h-4 w-4 text-primary" />
                          </Button>
                        </CustomFilePicker>
                      </div>
                    </div>
                    
                    {/* Inline Suggestions */}
                    {showSuggestions && (
                      <div className="flex flex-wrap gap-1 p-2 bg-muted/30 rounded-md border">
                        <span className="text-xs text-muted-foreground w-full mb-1">Tap to add:</span>
                        {suggestions.slice(0, 6).map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => insertSuggestion(suggestion)}
                            className="px-2 py-1 bg-card border border-border rounded-full text-xs hover:bg-muted/50 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                
                {/* Photo Upload Preview handled by CustomFilePicker */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-2"><SerkleLoader size="xs" />Compressing and uploading...</span>
                      <span className="text-muted-foreground">{Math.round(uploadProgress)}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Person conscious?</Label>
                  <div className="flex gap-2">
                    {['Yes', 'No', 'Unclear'].map((level) => (
                      <Button
                        key={level}
                        type="button"
                        variant={consciousLevel === level ? "default" : "outline"}
                        size="sm"
                        onClick={() => setConsciousLevel(level)}
                        className="flex-1 text-xs"
                      >
                        {level}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Age (approx)</Label>
                  <Input
                    placeholder="e.g., 25"
                    value={personAge}
                    onChange={(e) => setPersonAge(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {sosType === 'lost' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="person-desc">Who is missing? *</Label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Textarea
                        id="person-desc"
                        placeholder="Name, age, appearance, what they're wearing"
                        value={personDescription}
                        onChange={(e) => setPersonDescription(e.target.value)}
                        onFocus={handleTextareaFocus}
                        rows={2}
                        className="resize-none pr-10"
                      />
                      <div className="absolute bottom-2 right-2">
                        <CustomFilePicker
                          manager={sosFileManager}
                          onUpload={handleUpload}
                          multiple
                          hideUploadButton
                          accept="image/*"
                          maxFileSizeMB={10}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 bg-primary/10 hover:bg-primary/20 rounded-lg cursor-pointer transition-colors"
                            disabled={sosFileManager.files.length >= 3 || isUploading}
                          >
                            <Camera className="h-4 w-4 text-primary" />
                          </Button>
                        </CustomFilePicker>
                      </div>
                    </div>
                    
                    {/* Inline Suggestions */}
                    {showSuggestions && (
                      <div className="flex flex-wrap gap-1 p-2 bg-muted/30 rounded-md border">
                        <span className="text-xs text-muted-foreground w-full mb-1">Tap to add:</span>
                        {suggestions.slice(0, 6).map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => insertSuggestion(suggestion)}
                            className="px-2 py-1 bg-card border border-border rounded-full text-xs hover:bg-muted/50 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                
                {/* Photo Upload Preview handled by CustomFilePicker */}
                {isUploading && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2"><SerkleLoader size="xs" />Uploading photos...</div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="last-seen">When & where last seen? *</Label>
                <Input
                  id="last-seen"
                  placeholder="e.g., 2 hours ago at Central Mall"
                  value={lastSeen}
                  onChange={(e) => setLastSeen(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Age</Label>
                <Input
                  placeholder="Age of missing person"
                  value={personAge}
                  onChange={(e) => setPersonAge(e.target.value)}
                />
              </div>

            </>
          )}

          {sosType === 'safety' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="threat">What's the threat? *</Label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Textarea
                        id="threat"
                        placeholder="Brief description of the danger or threat"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onFocus={handleTextareaFocus}
                        rows={2}
                        className="resize-none pr-10"
                      />
                      <div className="absolute bottom-2 right-2">
                        <CustomFilePicker
                          manager={sosFileManager}
                          onUpload={handleUpload}
                          multiple
                          hideUploadButton
                          accept="image/*"
                          maxFileSizeMB={10}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 bg-primary/10 hover:bg-primary/20 rounded-lg cursor-pointer transition-colors"
                            disabled={sosFileManager.files.length >= 3 || isUploading}
                          >
                            <Camera className="h-4 w-4 text-primary" />
                          </Button>
                        </CustomFilePicker>
                      </div>
                    </div>
                    
                    {/* Inline Suggestions */}
                    {showSuggestions && (
                      <div className="flex flex-wrap gap-1 p-2 bg-muted/30 rounded-md border">
                        <span className="text-xs text-muted-foreground w-full mb-1">Tap to add:</span>
                        {suggestions.slice(0, 6).map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => insertSuggestion(suggestion)}
                            className="px-2 py-1 bg-card border border-border rounded-full text-xs hover:bg-muted/50 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                
                {/* Photo Upload Preview handled by CustomFilePicker */}
                {isUploading && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2"><SerkleLoader size="xs" />Uploading photos...</div>
                )}
              </div>
              
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Threat still active?</span>
                </div>
                <Switch
                  checked={threatActive}
                  onCheckedChange={setThreatActive}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>

            </>
          )}

          {sosType === 'emergency' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="emergency-desc">What's the emergency? *</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Textarea
                      id="emergency-desc"
                      placeholder="Brief description of the emergency situation"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onFocus={handleTextareaFocus}
                      rows={2}
                      className="resize-none pr-10"
                    />
                    <div className="absolute bottom-2 right-2">
                      <CustomFilePicker
                        manager={sosFileManager}
                        onUpload={handleUpload}
                        multiple
                        hideUploadButton
                        accept="image/*"
                        maxFileSizeMB={10}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-primary/10 hover:bg-primary/20 rounded-lg cursor-pointer transition-colors"
                          disabled={sosFileManager.files.length >= 3 || isUploading}
                        >
                          <Camera className="h-4 w-4 text-primary" />
                        </Button>
                      </CustomFilePicker>
                    </div>
                  </div>
                  
                  {/* Inline Suggestions */}
                  {showSuggestions && (
                    <div className="flex flex-wrap gap-1 p-2 bg-muted/30 rounded-md border">
                      <span className="text-xs text-muted-foreground w-full mb-1">Tap to add:</span>
                      {suggestions.slice(0, 6).map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => insertSuggestion(suggestion)}
                          className="px-2 py-1 bg-card border border-border rounded-full text-xs hover:bg-muted/50 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* CustomFilePicker integrated into textarea overlay above */}
                </div>
                
                {/* Photo Upload Preview handled by CustomFilePicker */}
                 {isUploading && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2"><SerkleLoader size="xs" />Uploading photos...</div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>How many people affected?</Label>
                <div className="flex gap-2">
                  {['1', '2-5', '5+', 'Unknown'].map((count) => (
                    <Button
                      key={count}
                      type="button"
                      variant={personAge === count ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPersonAge(count)}
                      className="flex-1 text-xs"
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="location"
                placeholder="Enter or confirm your location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="px-3"
                onClick={async () => {
                  triggerHaptic('light');
                  await refreshLocation();
                  if (latitude && longitude) {
                    setLocation(`GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
                    toast.success('Location detected');
                  } else {
                    toast.error('Unable to detect location. Please enable location services.');
                  }
                }}
              >
                <Target className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-secondary" />
                <span className="text-sm">Share live location</span>
              </div>
              <Switch
                checked={shareLocation}
                onCheckedChange={setShareLocation}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
          </div>

          {/* Quick Action for Emergency Call */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
            onClick={handleEmergencyCall}
          >
            <Phone className="h-4 w-4 mr-2" />
            Need Immediate Help? Call 911
          </Button>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
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
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={!isFormValid() || createAlert.isPending}
            >
              {createAlert.isPending ? (
                <div className="flex items-center gap-2">
                  <SerkleLoader size="xs" className="text-white" />
                  Sending...
                </div>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Send SOS Alert
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Emergency Alert
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-900">
                You are about to send an emergency alert to nearby helpers. This should only be used for real emergencies.
              </p>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>• Your location will be shared with nearby helpers</p>
              <p>• Push notifications will be sent to people in your area</p>
              <p>• False alerts may result in account suspension</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmedSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <SerkleLoader size="xs" className="text-white mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Siren className="h-4 w-4 mr-2" />
                    Confirm & Send Alert
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Privacy Modal */}
      <LocationPrivacyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onSave={(radius) => setAlertRadius(radius)}
        currentRadius={alertRadius}
      />
    </Dialog>
  );
};
