import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Bot, Plus, Trash2, Edit2, Zap, Shield } from 'lucide-react';

interface AutoRule {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  conditions: any;
  action: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminAutoModeration() {
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AutoRule | null>(null);
  const { logAction } = useAdminAudit();

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('threshold');
  const [formAction, setFormAction] = useState('flag');
  const [formSpamThreshold, setFormSpamThreshold] = useState('0.7');
  const [formHateThreshold, setFormHateThreshold] = useState('0.7');
  const [formNsfwThreshold, setFormNsfwThreshold] = useState('0.7');
  const [formKeywords, setFormKeywords] = useState('');

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('auto_moderation_rules')
      .select('*')
      .order('created_at', { ascending: false });
    setRules((data as AutoRule[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const resetForm = () => {
    setFormName(''); setFormDesc(''); setFormType('threshold'); setFormAction('flag');
    setFormSpamThreshold('0.7'); setFormHateThreshold('0.7'); setFormNsfwThreshold('0.7');
    setFormKeywords('');
  };

  const openEdit = (rule: AutoRule) => {
    setEditing(rule);
    setFormName(rule.name);
    setFormDesc(rule.description || '');
    setFormType(rule.rule_type);
    setFormAction(rule.action);
    if (rule.rule_type === 'threshold') {
      setFormSpamThreshold(String(rule.conditions?.spam_threshold || 0.7));
      setFormHateThreshold(String(rule.conditions?.hate_threshold || 0.7));
      setFormNsfwThreshold(String(rule.conditions?.nsfw_threshold || 0.7));
    } else if (rule.rule_type === 'keyword') {
      setFormKeywords((rule.conditions?.keywords || []).join(', '));
    }
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error('Name is required'); return; }

    const conditions: any = {};
    if (formType === 'threshold') {
      conditions.spam_threshold = parseFloat(formSpamThreshold);
      conditions.hate_threshold = parseFloat(formHateThreshold);
      conditions.nsfw_threshold = parseFloat(formNsfwThreshold);
    } else if (formType === 'keyword') {
      conditions.keywords = formKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    }

    const { data: session } = await supabase.auth.getSession();
    const payload = {
      name: formName,
      description: formDesc || null,
      rule_type: formType,
      conditions,
      action: formAction,
      created_by: session.session?.user?.id,
    };

    if (editing) {
      await supabase.from('auto_moderation_rules').update(payload).eq('id', editing.id);
      await logAction('update_auto_rule', 'moderation_rule', editing.id);
      toast.success('Rule updated');
    } else {
      await supabase.from('auto_moderation_rules').insert(payload);
      await logAction('create_auto_rule', 'moderation_rule');
      toast.success('Rule created');
    }

    setShowCreate(false);
    setEditing(null);
    resetForm();
    fetchRules();
  };

  const toggleRule = async (rule: AutoRule) => {
    await supabase.from('auto_moderation_rules').update({ is_active: !rule.is_active }).eq('id', rule.id);
    await logAction(rule.is_active ? 'disable_auto_rule' : 'enable_auto_rule', 'moderation_rule', rule.id);
    toast.success(rule.is_active ? 'Rule disabled' : 'Rule enabled');
    fetchRules();
  };

  const deleteRule = async (id: string) => {
    await supabase.from('auto_moderation_rules').delete().eq('id', id);
    await logAction('delete_auto_rule', 'moderation_rule', id);
    toast.success('Rule deleted');
    fetchRules();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Auto-Moderation Rules</h1>
        </div>
        <Button onClick={() => { resetForm(); setEditing(null); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Rule
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="col-span-full flex min-h-24 w-full items-center justify-center py-8"><SerkleLoader size="md" label="Loading data" /></div>
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No auto-moderation rules yet. Create one to automatically flag or remove content.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <Card key={rule.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <Switch checked={rule.is_active} onCheckedChange={() => toggleRule(rule)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{rule.name}</p>
                    <Badge variant="outline" className="text-[10px]">{rule.rule_type}</Badge>
                    <Badge variant={rule.action === 'remove' ? 'destructive' : rule.action === 'hide' ? 'secondary' : 'outline'} className="text-[10px]">
                      {rule.action}
                    </Badge>
                    {!rule.is_active && <Badge variant="outline" className="text-[10px] text-muted-foreground">Disabled</Badge>}
                  </div>
                  {rule.description && <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {rule.rule_type === 'threshold' && (
                      <span>
                        Spam ≥ {(rule.conditions?.spam_threshold * 100 || 70)}% · 
                        Hate ≥ {(rule.conditions?.hate_threshold * 100 || 70)}% · 
                        NSFW ≥ {(rule.conditions?.nsfw_threshold * 100 || 70)}%
                      </span>
                    )}
                    {rule.rule_type === 'keyword' && (
                      <span>Keywords: {(rule.conditions?.keywords || []).join(', ')}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rule)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteRule(rule.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={() => { setShowCreate(false); setEditing(null); resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Rule' : 'Create Auto-Moderation Rule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Rule name" value={formName} onChange={e => setFormName(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2} />
            
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Rule Type</label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="threshold">AI Score Threshold</SelectItem>
                    <SelectItem value="keyword">Keyword Match</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Action</label>
                <Select value={formAction} onValueChange={setFormAction}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flag">Flag for Review</SelectItem>
                    <SelectItem value="hide">Auto-Hide</SelectItem>
                    <SelectItem value="remove">Auto-Remove</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formType === 'threshold' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Spam threshold (0-1)</label>
                  <Input type="number" step="0.05" min="0" max="1" value={formSpamThreshold} onChange={e => setFormSpamThreshold(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Hate speech threshold (0-1)</label>
                  <Input type="number" step="0.05" min="0" max="1" value={formHateThreshold} onChange={e => setFormHateThreshold(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">NSFW threshold (0-1)</label>
                  <Input type="number" step="0.05" min="0" max="1" value={formNsfwThreshold} onChange={e => setFormNsfwThreshold(e.target.value)} />
                </div>
              </div>
            )}

            {formType === 'keyword' && (
              <div>
                <label className="text-xs text-muted-foreground">Keywords (comma-separated)</label>
                <Textarea value={formKeywords} onChange={e => setFormKeywords(e.target.value)} placeholder="spam, buy now, click here..." rows={3} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditing(null); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'} Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
