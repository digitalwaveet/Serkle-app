import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  ScrollText, Search, Download, ChevronLeft, ChevronRight,
  Shield, UserCog, FileText, Trash2, Edit2, Eye, Ban, Zap,
} from 'lucide-react';

interface AuditEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: any;
  created_at: string;
  admin_name?: string;
}

const ACTION_ICONS: Record<string, any> = {
  ban: Ban, unban: Ban, delete: Trash2, update: Edit2,
  create: FileText, view: Eye, bulk: Zap, role: UserCog,
};

const PAGE_SIZE = 25;

export default function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [searchAction, setSearchAction] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [adminProfiles, setAdminProfiles] = useState<Record<string, string>>({});

  const fetchEntries = useCallback(async () => {
    setLoading(true);

    let countQuery = supabase
      .from('admin_audit_log')
      .select('id', { count: 'exact', head: true });

    let query = supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (searchAction) {
      query = query.ilike('action', `%${searchAction}%`);
      countQuery = countQuery.ilike('action', `%${searchAction}%`);
    }
    if (filterType !== 'all') {
      query = query.eq('target_type', filterType);
      countQuery = countQuery.eq('target_type', filterType);
    }

    const [{ data }, { count }] = await Promise.all([query, countQuery]);
    setEntries((data as AuditEntry[]) || []);
    setTotal(count || 0);

    // Fetch admin profiles for display
    if (data && data.length > 0) {
      const adminIds = [...new Set(data.map((e: any) => e.admin_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username')
        .in('id', adminIds);

      if (profiles) {
        const map: Record<string, string> = {};
        profiles.forEach((p: any) => { map[p.id] = p.name || p.username; });
        setAdminProfiles(map);
      }
    }

    setLoading(false);
  }, [page, searchAction, filterType]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const exportCSV = () => {
    const headers = ['Timestamp', 'Admin', 'Action', 'Target Type', 'Target ID', 'Details'];
    const rows = entries.map(e => [
      e.created_at,
      adminProfiles[e.admin_id] || e.admin_id,
      e.action,
      e.target_type,
      e.target_id || '',
      JSON.stringify(e.details || {}),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActionIcon = (action: string) => {
    const key = Object.keys(ACTION_ICONS).find(k => action.toLowerCase().includes(k));
    const Icon = key ? ACTION_ICONS[key] : Shield;
    return <Icon className="h-3.5 w-3.5" />;
  };

  const actionColor = (action: string) => {
    if (action.includes('delete') || action.includes('ban') || action.includes('remove')) return 'text-destructive';
    if (action.includes('create') || action.includes('approve')) return 'text-primary';
    if (action.includes('update') || action.includes('enable')) return 'text-foreground';
    return 'text-muted-foreground';
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <Badge variant="outline" className="text-xs">{total} entries</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-3 w-3 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input
              placeholder="Search actions..."
              value={searchAction}
              onChange={e => { setSearchAction(e.target.value); setPage(0); }}
              className="h-9"
            />
          </div>
          <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(0); }}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="post">Post</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="comment">Comment</SelectItem>
              <SelectItem value="setting">Setting</SelectItem>
              <SelectItem value="moderation_rule">Moderation Rule</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Entries */}
      {loading ? (
        <div className="space-y-2">
          <div className="col-span-full flex min-h-24 w-full items-center justify-center py-8"><SerkleLoader size="md" label="Loading data" /></div>
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ScrollText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No audit log entries found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {entries.map(entry => (
            <Card key={entry.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`shrink-0 ${actionColor(entry.action)}`}>
                  {getActionIcon(entry.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{entry.action}</span>
                    <Badge variant="outline" className="text-[9px]">{entry.target_type}</Badge>
                    {entry.target_id && (
                      <span className="text-[10px] text-muted-foreground font-mono truncate max-w-32">
                        {entry.target_id.substring(0, 8)}...
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      by {adminProfiles[entry.admin_id] || 'Admin'}
                    </span>
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-64">
                        {JSON.stringify(entry.details).substring(0, 80)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {format(new Date(entry.created_at), 'MMM d, HH:mm:ss')}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
