import React, { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Bell, Volume2, Users, Shield } from 'lucide-react';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [userId, setUserId] = useState<string | null>(null);
  const { preferences, updatePreferences } = useNotificationPreferences(userId || undefined);
  const isMobile = useIsMobile();

  const [enabled, setEnabled] = useState(true);
  const [sosAlerts, setSosAlerts] = useState(true);
  const [helperResponses, setHelperResponses] = useState(true);
  const [alertUpdates, setAlertUpdates] = useState(true);
  const [emergencyContactAlerts, setEmergencyContactAlerts] = useState(true);
  const [maxDistance, setMaxDistance] = useState(10);
  const [quietHoursStart, setQuietHoursStart] = useState('');
  const [quietHoursEnd, setQuietHoursEnd] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  useEffect(() => {
    if (preferences) {
      setEnabled(preferences.enabled);
      setSosAlerts(preferences.sos_alerts);
      setHelperResponses(preferences.helper_responses);
      setAlertUpdates(preferences.alert_updates);
      setEmergencyContactAlerts(preferences.emergency_contact_alerts);
      setMaxDistance(preferences.max_distance_km);
      setQuietHoursStart(preferences.quiet_hours_start || '');
      setQuietHoursEnd(preferences.quiet_hours_end || '');
    }
  }, [preferences]);

  const handleSave = () => {
    updatePreferences.mutate({
      enabled,
      sos_alerts: sosAlerts,
      helper_responses: helperResponses,
      alert_updates: alertUpdates,
      emergency_contact_alerts: emergencyContactAlerts,
      max_distance_km: maxDistance,
      quiet_hours_start: quietHoursStart || null,
      quiet_hours_end: quietHoursEnd || null,
    });
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Notification Settings</DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 space-y-4 pb-4">
          {/* Master Toggle */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-primary" />
                <div>
                  <Label className="text-sm font-medium">Enable Notifications</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Master toggle for all alerts</p>
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </Card>

          {/* Alert Types */}
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Alert Types</Label>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="sos-alerts" className="text-sm">SOS Alerts Nearby</Label>
                <Switch
                  id="sos-alerts"
                  checked={sosAlerts}
                  onCheckedChange={setSosAlerts}
                  disabled={!enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="helper-responses" className="text-sm">Helper Responses</Label>
                <Switch
                  id="helper-responses"
                  checked={helperResponses}
                  onCheckedChange={setHelperResponses}
                  disabled={!enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="alert-updates" className="text-sm">Alert Updates</Label>
                <Switch
                  id="alert-updates"
                  checked={alertUpdates}
                  onCheckedChange={setAlertUpdates}
                  disabled={!enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="emergency-contacts" className="text-sm">Emergency Contact Alerts</Label>
                <Switch
                  id="emergency-contacts"
                  checked={emergencyContactAlerts}
                  onCheckedChange={setEmergencyContactAlerts}
                  disabled={!enabled}
                />
              </div>
            </div>
          </Card>

          {/* Distance Range */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Alert Distance: {maxDistance} km</Label>
            </div>
            <Slider
              value={[maxDistance]}
              onValueChange={([value]) => setMaxDistance(value)}
              min={1}
              max={50}
              step={1}
              disabled={!enabled}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Receive alerts within this radius
            </p>
          </Card>

          {/* Quiet Hours */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Quiet Hours</Label>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="quiet-start" className="text-xs text-muted-foreground">Start Time</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(e.target.value)}
                  disabled={!enabled}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quiet-end" className="text-xs text-muted-foreground">End Time</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(e.target.value)}
                  disabled={!enabled}
                  className="h-10"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Only critical alerts during these hours
            </p>
          </Card>
        </div>

        <DrawerFooter className="border-t bg-background">
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1 touch-target">
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={updatePreferences.isPending}
              className="flex-1 touch-target"
            >
              {updatePreferences.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
