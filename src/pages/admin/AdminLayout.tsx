import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowUpRight, Award, BarChart3, Bell, Bot, Brain, ChevronRight, CircleDot, ClipboardList, FileBarChart, FileText, Flag, HeartPulse, HelpCircle, LayoutDashboard, LogOut, Menu, MessageCircle, MessageSquare, Radio, Scale, ScrollText, Search, Settings, Shield, Store, UserCog, Users, Video, Wallet, Webhook, Zap, Megaphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/sonner';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { supabase } from '@/integrations/supabase/client';
import './admin.css';

const sections: { label: string; links: { label: string; path: string; icon: LucideIcon; superAdmin?: boolean }[] }[] = [
  { label: 'Workspace', links: [
    { label: 'Overview', path: 'dashboard', icon: LayoutDashboard },
    { label: 'Alerts', path: 'alerts', icon: Bell },
    { label: 'Platform health', path: 'platform-health', icon: HeartPulse },
    { label: 'Wallet operations', path: 'wallet', icon: Wallet, superAdmin: true },
    { label: 'Audit log', path: 'audit-log', icon: ScrollText },
  ] },
  { label: 'Moderation', links: [
    { label: 'Content reports', path: 'reports', icon: Flag },
    { label: 'Review queue', path: 'content-queue', icon: ClipboardList },
    { label: 'Appeals', path: 'appeals', icon: Scale },
    { label: 'AI moderation', path: 'ai-moderation', icon: Brain },
    { label: 'Auto rules', path: 'auto-moderation', icon: Bot },
    { label: 'Bulk actions', path: 'bulk-actions', icon: Zap },
  ] },
  { label: 'People & communities', links: [
    { label: 'Users', path: 'users', icon: Users },
    { label: 'Roles', path: 'roles', icon: UserCog },
    { label: 'Circles', path: 'circles', icon: CircleDot },
    { label: 'Ask moderation', path: 'ask-moderation', icon: HelpCircle },
    { label: 'Expert verification', path: 'expert-verification', icon: Award },
  ] },
  { label: 'Content & communication', links: [
    { label: 'Posts', path: 'posts', icon: FileText },
    { label: 'Videos', path: 'videos', icon: Video },
    { label: 'Comments', path: 'comments', icon: MessageCircle },
    { label: 'Live streams', path: 'live-streams', icon: Radio },
    { label: 'Messages', path: 'messages', icon: MessageSquare },
    { label: 'Broadcasts', path: 'communication', icon: Megaphone },
  ] },
  { label: 'Insights & settings', links: [
    { label: 'Growth', path: 'analytics', icon: BarChart3 },
    { label: 'Engagement', path: 'engagement', icon: Activity },
    { label: 'Analytics reports', path: 'reporting', icon: FileBarChart },
    { label: 'Webhooks', path: 'webhooks', icon: Webhook },
    { label: 'Settings', path: 'settings', icon: Settings },
  ] },
  { label: 'Shop & safety', links: [
    { label: 'Shop management', path: 'shop', icon: Store },
    { label: 'SOS operations', path: 'safety', icon: Shield },
  ] },
];

function AdminNav({ isSuperAdmin, close }: { isSuperAdmin: boolean; close?: () => void }) {
  const [search, setSearch] = useState('');
  const needle = search.trim().toLocaleLowerCase();
  const visible = sections.map(({ label, links }) => ({
    label,
    links: links.filter((link) => (!link.superAdmin || isSuperAdmin) &&
      `${label} ${link.label}`.toLocaleLowerCase().includes(needle)),
  })).filter(({ links }) => links.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <Link to="/admin/dashboard" onClick={close} className="admin-brand">
        <span className="admin-brand-mark"><img src="/lovable-uploads/SerkleLogoMarkWhiteColor.svg" alt="" /></span>
        <span><strong>Serkle</strong><small>Administration</small></span>
      </Link>
      <div className="relative mx-4 mb-3">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-10 rounded-lg bg-background pl-9 text-sm" aria-label="Find an admin page" placeholder="Find a page" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <nav aria-label="Admin navigation" className="admin-nav-list">
        {visible.length === 0 && <p role="status" className="px-3 text-sm text-muted-foreground">No pages match.</p>}
        {visible.map(({ label, links }) => (
          <div className="admin-nav-group" key={label}>
            <p>{label}</p>
            {links.map(({ label: title, path, icon: Icon }) => (
              <NavLink key={path} end to={`/admin/${path}`} onClick={close} className="admin-nav-link">
                <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
                <span>{title}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { adminRole } = useAdminAuth();
  const isSuperAdmin = adminRole === 'super_admin';
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const section = sections.find(({ links }) => links.some(({ path }) => pathname === `/admin/${path}`));
  const pageLabel = section?.links.find(({ path }) => pathname === `/admin/${path}`)?.label ?? 'Overview';

  const signOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login', { replace: true });
    } catch {
      toast.error('Could not sign out. Try again.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="admin-shell">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-md focus:bg-card focus:p-3">Skip to main content</a>
      <aside className="admin-sidebar"><AdminNav isSuperAdmin={isSuperAdmin} /></aside>
      <div className="min-w-0">
        <header className="admin-topbar">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 lg:hidden" aria-label="Open admin navigation"><Menu size={21} /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex h-[100dvh] w-[min(88vw,21rem)] flex-col gap-0 p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] [&>button]:top-[calc(1rem+env(safe-area-inset-top))] [&>button]:p-2">
                <SheetTitle className="sr-only">Admin navigation</SheetTitle>
                <AdminNav isSuperAdmin={isSuperAdmin} close={() => setDrawerOpen(false)} />
              </SheetContent>
            </Sheet>
            {section && <span className="hidden text-sm text-muted-foreground xl:inline">{section.label}</span>}
            {section && <ChevronRight size={14} className="hidden text-muted-foreground xl:block" aria-hidden="true" />}
            <span className="truncate text-sm font-semibold">{pageLabel}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {adminRole && <Badge variant="outline" className="hidden rounded-full border-primary/20 bg-primary/5 px-2.5 text-primary sm:inline-flex">{isSuperAdmin ? 'Super admin' : 'Admin'}</Badge>}
            <Button asChild variant="ghost" className="h-11 px-2 sm:px-3" aria-label="Back to Serkle">
              <Link to="/"><ArrowUpRight size={17} aria-hidden="true" /><span className="ml-1 hidden md:inline">Back to Serkle</span></Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-10" aria-label="Sign out" disabled={signingOut} onClick={() => void signOut()}><LogOut size={17} /></Button>
          </div>
        </header>
        <main id="admin-main" tabIndex={-1} className="admin-main"><Outlet /></main>
      </div>
      <Toaster closeButton />
    </div>
  );
}
