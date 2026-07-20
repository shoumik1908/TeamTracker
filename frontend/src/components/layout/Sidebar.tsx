import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Award, FolderKanban,
  Bell, FileBarChart, ChevronLeft, ChevronRight,
  Diff, Target, Rocket, FolderOpen, History, ShieldCheck, } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/members', icon: Users, label: 'Team Members' },
  { to: '/certifications', icon: Award, label: 'Certifications' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/presales', icon: Target, label: 'PreSales' },
  { to: '/gtm', icon: Rocket, label: 'GTM' },
  { to: '/project-updates', icon: Diff, label: 'Project Updates' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/tasks', icon: Target, label: 'Tasks' },
  { to: '/reports', icon: FileBarChart, label: 'Reports' },
  { to: '/files', icon: FolderOpen, label: 'Files' }
];


export default function Sidebar({ 
  isMobileMenuOpen, 
  setIsMobileMenuOpen 
}: { 
  isMobileMenuOpen: boolean; 
  setIsMobileMenuOpen: (val: boolean) => void; 
}) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const { data } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationsApi.list({ unreadOnly: 'true', limit: '1' }),
    staleTime: 60000,
  });
  const unreadCount = data?.data?.unreadCount || 0;
  
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission('manageTeam');

  const filteredNavItems = isAdmin 
    ? [...navItems, { to: '/logs', icon: History, label: 'Logs' }, { to: '/admin/credentials', icon: ShieldCheck, label: 'Access Management' }]
    : navItems;

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          'flex flex-col h-screen bg-[#14121b]/40 backdrop-blur-xl border-r border-white/5 transition-all duration-300 ease-in-out relative z-50 flex-shrink-0',
          'md:relative absolute top-0 left-0',
          isMobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full md:translate-x-0',
          collapsed ? 'md:w-16 w-64' : 'w-64'
        )}
      >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-white/5', collapsed && 'justify-center px-2')}>
        <img src="/logo.png" alt="Logo" className="flex-shrink-0 w-8 h-8 shadow-lg shadow-black/20" />
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <p className="text-foreground font-bold text-sm leading-tight">Team Tracker</p>
            <p className="text-muted-foreground text-xs">Enterprise Dashboard</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {filteredNavItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          const isNotifications = to === '/notifications';
          const badge = isNotifications ? unreadCount : 0;

          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'sidebar-link group relative',
                isActive && 'active',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? label : undefined}
            >
              <div className="relative flex-shrink-0">
                <Icon className="w-5 h-5" />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              {!collapsed && (
                <span className="truncate">{label}</span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md
                                opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50
                                transition-opacity duration-150">
                  {label}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle (Desktop only) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden md:flex absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full
                   items-center justify-center shadow-md hover:shadow-lg transition-shadow
                   text-muted-foreground hover:text-foreground z-30"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

    </aside>
    </>
  );
}


