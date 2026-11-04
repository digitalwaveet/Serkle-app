import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Shield, Plus, Trash2, Search, UserCog } from 'lucide-react';
import { format } from 'date-fns';

interface RoleUser {
  user_id: string;
  role: string;
  profile?: { username: string; name: string; email: string; avatar_url: string | null };
}

interface AuditEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: any;
  created_at: string;
  admin_profile?: { username: string; name: string };
}

export default function AdminRoles() {
  const { adminRole } = useAdminAuth();
  const { logAction } = useAdminAudit();
  const isSuperAdmin = adminRole === 'super_admin';

  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [inviting, setInviting] = useState(false);

  // Audit filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');

  useEffect(() => {
    fetchRoles();
    fetchAuditLog();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (error) {
      console.error('Error fetching roles:', error);
      setLoading(false);
      return;
    }

    // Fetch profiles for each role user
    const userIds = (data || []).map((r: any) => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, name, email, avatar_url')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const enriched = (data || []).map((r: any) => ({
      ...r,
      profile: profileMap.get(r.user_id),
    }));

    setRoleUsers(enriched);
    setLoading(false);
  };

  const fetchAuditLog = async () => {
    setAuditLoading(true);
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching audit log:', error);
      setAuditLoading(false);
      return;
    }

    // Fetch admin profiles
    const adminIds = [...new Set((data || []).map((e: any) => e.admin_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, name')
      .in('id', adminIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const enriched = (data || []).map((e: any) => ({
      ...e,
      admin_profile: profileMap.get(e.admin_id),
    }));

    setAuditLog(enriched);
    setAuditLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);

    // Find user by email
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('email', inviteEmail.trim())
      .maybeSingle();

    if (profileErr || !profile) {
      toast({ title: 'User not found', description: 'No account with that email exists.', variant: 'destructive' });
      setInviting(false);
      return;
    }

    // Insert role
    const { error } = await supabase
      .from('user_roles')
      .insert([{ user_id: profile.id, role: inviteRole as any }]);

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Already assigned', description: 'This user already has this role.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } else {
      await logAction('assign_role', 'user', profile.id, { role: inviteRole, email: inviteEmail });
      toast({ title: 'Role assigned', description: `${inviteRole} role assigned to ${profile.username}` });
      setInviteEmail('');
      fetchRoles();
    }
    setInviting(false);
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role as any);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      await logAction('remove_role', 'user', userId, { role });
      toast({ title: 'Role removed' });
      fetchRoles();
    }
  };

  const filteredAudit = auditLog.filter((e) => {
    if (auditActionFilter !== 'all' && !e.action.includes(auditActionFilter)) return false;
    if (auditSearch && !e.action.includes(auditSearch) && !e.target_type.includes(auditSearch) && !(e.admin_profile?.name || '').toLowerCase().includes(auditSearch.toLowerCase())) return false;
    return true;
  });

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-primary/20 text-primary border-primary/30';
      case 'admin': return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Roles & Permissions</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage admin team and review audit trail</p>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">
            <UserCog className="h-4 w-4 mr-1" /> Roles
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Shield className="h-4 w-4 mr-1" /> Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4 mt-4">
          {/* Invite Section */}
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Assign Role
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="User email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInvite} disabled={inviting}>
                    {inviting ? 'Assigning...' : 'Assign'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Roles Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <SerkleLoader size="md" className="text-current" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      {isSuperAdmin && <TableHead className="w-20">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roleUsers.map((ru, idx) => (
                      <TableRow key={`${ru.user_id}-${ru.role}-${idx}`}>
                        <TableCell className="font-medium">
                          {ru.profile?.name || 'Unknown'}
                          <span className="text-muted-foreground ml-1 text-xs">@{ru.profile?.username}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{ru.profile?.email || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={roleBadgeColor(ru.role)}>
                            {ru.role.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveRole(ru.user_id, ru.role)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {roleUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No roles assigned yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4 mt-4">
          {/* Audit Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search audit log..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="assign_role">Role Assigned</SelectItem>
                <SelectItem value="remove_role">Role Removed</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="ban">Ban</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Audit Table */}
          <Card>
            <CardContent className="p-0">
              {auditLoading ? (
                <div className="flex justify-center py-12">
                  <SerkleLoader size="md" className="text-current" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admin</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAudit.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium text-sm">
                          {entry.admin_profile?.name || entry.admin_id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {entry.target_type}
                          {entry.target_id && <span className="ml-1 text-xs">({entry.target_id.slice(0, 8)})</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {format(new Date(entry.created_at), 'MMM d, HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredAudit.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No audit entries found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
