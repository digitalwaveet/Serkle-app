import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Outlet, useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  SidebarProvider,
  SidebarTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, FileText, Video, ArrowLeft, Shield, LogOut, Bell, UserCog, MessageSquare, Flag, Scale, BarChart3, Settings, MessageCircle, Brain, Bot, Zap, Webhook, Activity, ClipboardList, ScrollText, HeartPulse, Megaphone, CircleDot, FileBarChart, HelpCircle, Radio, Store, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const navSections = [
  {
    label: 'Overview',
    items: [
      { title: 'Dashboard', url: '/admin/dashboard', icon: LayoutDashboard },
      { title: 'Alerts', url: '/admin/alerts', icon: Bell },
    ],
  },
  {
    label: 'Users',
    items: [
      { title: 'Users', url: '/admin/users', icon: Users },
      { title: 'Roles', url: '/admin/roles', icon: UserCog },
      { title: 'Expert Verification', url: '/admin/expert-verification', icon: Award },
    ],
  },
  {
    label: 'Content',
    items: [
      { title: 'Posts', url: '/admin/posts', icon: FileText },
      { title: 'Videos', url: '/admin/videos', icon: Video },
      { title: 'Comments', url: '/admin/comments', icon: MessageCircle },
      { title: 'Circles', url: '/admin/circles', icon: CircleDot },
      { title: 'Q&A', url: '/admin/ask-moderation', icon: HelpCircle },
      { title: 'Live Streams', url: '/admin/live-streams', icon: Radio },
    ],
  },
  {
    label: 'Moderation',
    items: [
      { title: 'Reports', url: '/admin/reports', icon: Flag },
      { title: 'Appeals', url: '/admin/appeals', icon: Scale },
      { title: 'AI Moderation', url: '/admin/ai-moderation', icon: Brain },
      { title: 'Auto Rules', url: '/admin/auto-moderation', icon: Bot },
      { title: 'Review Queue', url: '/admin/content-queue', icon: ClipboardList },
      { title: 'Bulk Actions', url: '/admin/bulk-actions', icon: Zap },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { title: 'Growth', url: '/admin/analytics', icon: BarChart3 },
      { title: 'Engagement', url: '/admin/engagement', icon: Activity },
      { title: 'Reports', url: '/admin/reporting', icon: FileBarChart },
    ],
  },
  {
    label: 'Safety',
    items: [
      { title: 'SOS Operations', url: '/admin/safety', icon: Shield },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { title: 'Shop Management', url: '/admin/shop', icon: Store },
    ],
  },
  {
    label: 'Communication',
    items: [
      { title: 'Messages', url: '/admin/messages', icon: MessageSquare },
      { title: 'Broadcasts', url: '/admin/communication', icon: Megaphone },
    ],
  },
  {
    label: 'System',
    items: [
      { title: 'Platform Health', url: '/admin/platform-health', icon: HeartPulse },
      { title: 'Audit Log', url: '/admin/audit-log', icon: ScrollText },
      { title: 'Webhooks', url: '/admin/webhooks', icon: Webhook },
      { title: 'Settings', url: '/admin/settings', icon: Settings },
    ],
  },
];

function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="bg-card">
        <div className={`p-4 flex items-center gap-2 border-b border-border ${collapsed ? 'justify-center' : ''}`}>
          <Shield className="h-6 w-6 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-bold text-lg text-foreground">Admin</span>
          )}
        </div>

        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <Link
                          to={item.url}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                            isActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

function AdminHeader({ adminRole }: { adminRole: string | null }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <span className="text-sm font-medium text-foreground hidden sm:inline">Admin Panel</span>
      </div>
      <div className="flex items-center gap-3">
        {adminRole && (
          <Badge variant="outline" className="text-xs capitalize border-primary/30 text-primary">
            {adminRole.replace('_', ' ')}
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Back to App</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

export default function AdminLayout() {
  const { isAdmin, isLoading, adminRole } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <SerkleLoader size="md" className="text-current" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader adminRole={adminRole} />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
