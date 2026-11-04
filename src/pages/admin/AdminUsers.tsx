import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { Search, MoreHorizontal, Ban, Shield, Eye, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UserRow {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar_url: string | null;
  initials: string;
  avatar_color: string | null;
  is_verified: boolean;
  created_at: string;
  banned_at: string | null;
  suspended_until: string | null;
  admin_notes: string | null;
}

const PAGE_SIZE = 20;

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'banned' | 'suspended' | 'verified'>('all');
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: string; user: UserRow } | null>(null);
  const [actionNote, setActionNote] = useState('');
  const { logAction } = useAdminAudit();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('id, name, username, email, avatar_url, initials, avatar_color, is_verified, created_at, banned_at, suspended_until, admin_notes', { count: 'exact' });

      if (search) {
        query = query.or(`name.ilike.%${search}%,username.ilike.%${search}%,email.ilike.%${search}%`);
      }

      if (filter === 'banned') query = query.not('banned_at', 'is', null);
      else if (filter === 'suspended') query = query.not('suspended_until', 'is', null);
      else if (filter === 'verified') query = query.eq('is_verified', true);

      query = query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      setUsers((data as UserRow[]) || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [search, page, filter]);

  useEffect(() => {
    const timeout = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timeout);
  }, [fetchUsers]);

  const handleAction = async (type: string, user: UserRow) => {
    try {
      if (type === 'ban') {
        await supabase.from('profiles').update({ banned_at: new Date().toISOString(), admin_notes: actionNote || user.admin_notes }).eq('id', user.id);
        await logAction('ban_user', 'user', user.id, { reason: actionNote });
        toast.success(`${user.name} has been banned`);
      } else if (type === 'unban') {
        await supabase.from('profiles').update({ banned_at: null }).eq('id', user.id);
        await logAction('unban_user', 'user', user.id);
        toast.success(`${user.name} has been unbanned`);
      } else if (type === 'verify') {
        await supabase.from('profiles').update({ is_verified: true }).eq('id', user.id);
        await logAction('verify_user', 'user', user.id);
        toast.success(`${user.name} has been verified`);
      } else if (type === 'unverify') {
        await supabase.from('profiles').update({ is_verified: false }).eq('id', user.id);
        await logAction('unverify_user', 'user', user.id);
        toast.success(`${user.name} verification removed`);
      } else if (type === 'warn') {
        await logAction('warn_user', 'user', user.id, { message: actionNote });
        toast.success(`Warning sent to ${user.name}`);
      }
      setActionDialog(null);
      setActionNote('');
      fetchUsers();
    } catch (err) {
      toast.error('Action failed');
    }
  };

  const getStatusBadge = (user: UserRow) => {
    if (user.banned_at) return <Badge variant="destructive" className="text-xs">Banned</Badge>;
    if (user.suspended_until && new Date(user.suspended_until) > new Date()) return <Badge className="bg-orange-500/10 text-orange-600 text-xs">Suspended</Badge>;
    return <Badge variant="outline" className="text-xs text-green-600 border-green-300">Active</Badge>;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <Badge variant="secondary">{totalCount} users</Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, username, or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-10"
            />
          </div>
          <Select value={filter} onValueChange={(v: any) => { setFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden sm:table-cell">Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center"><SerkleLoader label="Loading records" showText /></TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedUser(user)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url || ''} />
                          <AvatarFallback style={{ backgroundColor: user.avatar_color || undefined }} className="text-xs text-white">
                            {user.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground flex items-center gap-1">
                            {user.name}
                            {user.is_verified && <Shield className="h-3 w-3 text-primary" />}
                          </p>
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>{getStatusBadge(user)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedUser(user); }}>
                            <Eye className="h-4 w-4 mr-2" /> View Profile
                          </DropdownMenuItem>
                          {user.banned_at ? (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAction('unban', user); }}>
                              <Shield className="h-4 w-4 mr-2" /> Unban
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setActionDialog({ type: 'ban', user }); }} className="text-destructive">
                              <Ban className="h-4 w-4 mr-2" /> Ban User
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setActionDialog({ type: 'warn', user }); }}>
                            <AlertTriangle className="h-4 w-4 mr-2" /> Warn User
                          </DropdownMenuItem>
                          {user.is_verified ? (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAction('unverify', user); }}>
                              Remove Verification
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAction('verify', user); }}>
                              Verify User
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedUser.avatar_url || ''} />
                  <AvatarFallback style={{ backgroundColor: selectedUser.avatar_color || undefined }} className="text-lg text-white">
                    {selectedUser.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{selectedUser.name}</p>
                  <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Joined</p>
                  <p className="font-medium">{format(new Date(selectedUser.created_at), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  {getStatusBadge(selectedUser)}
                </div>
                <div>
                  <p className="text-muted-foreground">Verified</p>
                  <p className="font-medium">{selectedUser.is_verified ? 'Yes' : 'No'}</p>
                </div>
              </div>
              {selectedUser.admin_notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Admin Notes</p>
                  <p className="text-sm bg-muted p-2 rounded">{selectedUser.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog (Ban/Warn) */}
      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setActionNote(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === 'ban' ? 'Ban User' : 'Warn User'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {actionDialog?.type === 'ban'
              ? `Are you sure you want to ban ${actionDialog?.user.name}?`
              : `Send a warning to ${actionDialog?.user.name}.`}
          </p>
          <Textarea
            placeholder={actionDialog?.type === 'ban' ? 'Reason for ban...' : 'Warning message...'}
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setActionNote(''); }}>Cancel</Button>
            <Button
              variant={actionDialog?.type === 'ban' ? 'destructive' : 'default'}
              onClick={() => actionDialog && handleAction(actionDialog.type, actionDialog.user)}
            >
              {actionDialog?.type === 'ban' ? 'Ban User' : 'Send Warning'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
