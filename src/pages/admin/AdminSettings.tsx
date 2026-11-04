import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { useToast } from '@/hooks/use-toast';
import { Settings, Shield, Upload, MessageSquare, Video, Users, Wrench } from 'lucide-react';

interface SettingValue {
  enabled?: boolean;
  message?: string;
  value?: number | string;
}

interface SettingRow {
  key: string;
  value: SettingValue;
  updated_at: string;
}

const DEFAULT_SETTINGS: Record<string, SettingValue> = {
  feature_messaging: { enabled: true },
  feature_video: { enabled: true },
  feature_circles: { enabled: true },
  feature_shop: { enabled: true },
  feature_ask: { enabled: true },
  maintenance_mode: { enabled: false, message: 'We are currently performing maintenance. Please check back soon.' },
  max_upload_size_mb: { value: 50 },
  content_age_restriction: { enabled: false },
};

const SETTING_META: Record<string, { label: string; description: string; icon: any; group: string }> = {
  feature_messaging: { label: 'Messaging', description: 'Enable/disable the messaging feature', icon: MessageSquare, group: 'Features' },
  feature_video: { label: 'Video Uploads', description: 'Enable/disable video creation and feed', icon: Video, group: 'Features' },
  feature_circles: { label: 'Circles', description: 'Enable/disable community circles', icon: Users, group: 'Features' },
  feature_shop: { label: 'Shop', description: 'Enable/disable the marketplace', icon: Wrench, group: 'Features' },
  feature_ask: { label: 'Ask (Q&A)', description: 'Enable/disable the Q&A module', icon: MessageSquare, group: 'Features' },
  maintenance_mode: { label: 'Maintenance Mode', description: 'Show maintenance page to all non-admin users', icon: Shield, group: 'System' },
  max_upload_size_mb: { label: 'Max Upload Size (MB)', description: 'Maximum file upload size in megabytes', icon: Upload, group: 'System' },
  content_age_restriction: { label: 'Age Restriction', description: 'Enable age-gated content warnings', icon: Shield, group: 'System' },
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { logAction } = useAdminAudit();
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('key, value, updated_at');

    if (error) {
      console.error('Failed to fetch settings:', error);
      setSettings({ ...DEFAULT_SETTINGS });
    } else {
      const merged = { ...DEFAULT_SETTINGS };
      (data as SettingRow[])?.forEach((row) => {
        merged[row.key] = row.value as SettingValue;
      });
      setSettings(merged);
    }
    setLoading(false);
  };

  const saveSetting = async (key: string, value: SettingValue) => {
    setSaving(key);
    const { data: session } = await supabase.auth.getSession();
    const adminId = session.session?.user?.id;

    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        key,
        value: value as any,
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      toast({ title: 'Error', description: `Failed to save ${key}`, variant: 'destructive' });
    } else {
      setSettings((prev) => ({ ...prev, [key]: value }));
      toast({ title: 'Saved', description: `${SETTING_META[key]?.label || key} updated.` });
      await logAction('update_setting', 'setting', key, { value });
    }
    setSaving(null);
  };

  const handleToggle = (key: string, checked: boolean) => {
    const current = settings[key] || {};
    saveSetting(key, { ...current, enabled: checked });
  };

  const handleNumberChange = (key: string, val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setSettings((prev) => ({ ...prev, [key]: { ...prev[key], value: num } }));
    }
  };

  const handleMessageChange = (key: string, message: string) => {
    setSettings((prev) => ({ ...prev, [key]: { ...prev[key], message } }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">App Configuration</h1>
        <div className="space-y-4">
          <div className="col-span-full flex min-h-24 w-full items-center justify-center py-8"><SerkleLoader size="md" label="Loading data" /></div>
        </div>
      </div>
    );
  }

  const groups = Object.entries(SETTING_META).reduce<Record<string, string[]>>((acc, [key, meta]) => {
    if (!acc[meta.group]) acc[meta.group] = [];
    acc[meta.group].push(key);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">App Configuration</h1>
      </div>

      {Object.entries(groups).map(([group, keys]) => (
        <div key={group} className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{group}</h2>

          {keys.map((key) => {
            const meta = SETTING_META[key];
            const val = settings[key] || DEFAULT_SETTINGS[key];
            const Icon = meta.icon;
            const isToggle = 'enabled' in (val || {});
            const isNumber = 'value' in (val || {}) && typeof val.value === 'number';
            const hasMessage = 'message' in (val || {});

            return (
              <Card key={key}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="mt-1 p-2 rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{meta.label}</p>
                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                      </div>
                      {isToggle && (
                        <Switch
                          checked={val.enabled ?? false}
                          onCheckedChange={(checked) => handleToggle(key, checked)}
                          disabled={saving === key}
                        />
                      )}
                    </div>

                    {hasMessage && val.enabled && (
                      <div className="flex gap-2">
                        <Input
                          value={val.message || ''}
                          onChange={(e) => handleMessageChange(key, e.target.value)}
                          placeholder="Maintenance message..."
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={() => saveSetting(key, val)}
                          disabled={saving === key}
                        >
                          Save
                        </Button>
                      </div>
                    )}

                    {isNumber && (
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          value={val.value as number}
                          onChange={(e) => handleNumberChange(key, e.target.value)}
                          className="w-32 text-sm"
                          min={1}
                          max={500}
                        />
                        <span className="text-xs text-muted-foreground">MB</span>
                        <Button
                          size="sm"
                          onClick={() => saveSetting(key, val)}
                          disabled={saving === key}
                        >
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                  {saving === key && <Badge variant="outline" className="text-xs">Saving...</Badge>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}
