import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, X, Loader2, Menu, LogOut, User as UserIcon, KeyRound } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { searchApi, notificationsApi } from '@/lib/api';
import { cn, formatRelative, getInitials } from '@/lib/utils';
import type { SearchResults, Notification } from '@/types';

export default function Header({ 
  title,
  setIsMobileMenuOpen
}: { 
  title?: string;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (val: boolean) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, logout } = useAuth();

  const { data: searchData, isFetching: isSearching } = useQuery<SearchResults>({
    queryKey: ['search', searchQuery],
    queryFn: () => searchApi.global(searchQuery).then(r => r.data),
    enabled: searchQuery.length >= 2,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications-panel'],
    queryFn: () => notificationsApi.list({ limit: '8' }).then(r => r.data),
    enabled: showNotifications,
    refetchInterval: showNotifications ? 15000 : false,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-panel'] });
    },
  });

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const notifTypeIcon: Record<string, string> = {
    CERTIFICATION_ASSIGNED: '📋', DEADLINE_APPROACHING: '⏰',
    CERTIFICATE_UPLOADED: '📄', CERTIFICATION_COMPLETED: '🎉',
    PROJECT_UPDATED: '🚀', PROJECT_ASSIGNED: '👥',
  };

  return (
    <header className="h-14 bg-background/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-50 w-full relative">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        {/* Page title */}
        <h1 className="text-base md:text-lg font-semibold text-foreground truncate max-w-[120px] sm:max-w-none">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Global Search */}
        <div ref={searchRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onFocus={() => setShowSearch(true)}
              onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
              className="w-32 sm:w-48 md:w-72 pl-9 pr-8 py-2 text-sm bg-card/5 border border-white/5 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                         placeholder:text-muted-foreground/60 transition-all text-white"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setShowSearch(false); }} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearch && searchQuery.length >= 2 && (
            <div className="absolute top-full mt-2 w-full bg-card rounded-xl border border-border shadow-xl z-50 overflow-hidden animate-fade-in">
              {isSearching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-azure-500" />
                </div>
              ) : searchData ? (
                <div className="max-h-80 overflow-y-auto">
                  {searchData.members.length > 0 && (
                    <div>
                      <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">Members</p>
                      {searchData.members.map(m => (
                        <button key={m.id} onClick={() => { navigate(`/members/${m.id}`); setShowSearch(false); setSearchQuery(''); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 text-left">
                          <div className="w-8 h-8 rounded-full bg-azure-500/10 flex items-center justify-center text-azure-600 text-xs font-bold flex-shrink-0">
                            {m.profilePictureUrl ? <img src={m.profilePictureUrl} className="w-full h-full rounded-full object-cover" alt="" /> : getInitials(m.name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{m.name}</p>
                            <p className="text-xs text-muted-foreground">{m.designation}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchData.certifications.length > 0 && (
                    <div>
                      <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">Certifications</p>
                      {searchData.certifications.map(c => (
                        <button key={c.id} onClick={() => { navigate('/certifications'); setShowSearch(false); setSearchQuery(''); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 text-left">
                          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-700 text-xs font-bold flex-shrink-0">🎓</div>
                          <div>
                            <p className="text-sm font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.provider}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchData.projects.length > 0 && (
                    <div>
                      <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">Projects</p>
                      {searchData.projects.map(p => (
                        <button key={p.id} onClick={() => { navigate('/projects'); setShowSearch(false); setSearchQuery(''); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 text-left">
                          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-700 text-xs font-bold flex-shrink-0">🚀</div>
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.status.replace(/_/g, ' ')} · {p.progress}%</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchData.members.length === 0 && searchData.certifications.length === 0 && searchData.projects.length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">No results found</div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={cn(
              'relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
              showNotifications ? 'bg-azure-950/40 text-azure-400' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Bell className="w-5 h-5" />
            {(notifData?.unreadCount || 0) > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-[85vw] sm:w-96 bg-card rounded-xl border border-border shadow-xl z-50 overflow-hidden animate-fade-in -mr-2 sm:mr-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="font-semibold text-sm">Notifications</p>
                <button onClick={() => markAllRead.mutate()} className="text-xs text-azure-400 hover:text-azure-300 font-medium">Mark all read</button>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
                {notifData?.data?.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
                )}
                {notifData?.data?.map((n: Notification) => (
                  <div key={n.id} onClick={() => markRead.mutate(n.id)}
                    className={cn('flex gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors', !n.read && 'bg-azure-950/20')}>
                    <span className="text-lg flex-shrink-0 mt-0.5">{notifTypeIcon[n.type] || '📢'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">{formatRelative(n.createdAt)}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 bg-azure-500 rounded-full mt-2 flex-shrink-0" />}
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-2">
                <button onClick={() => { navigate('/notifications'); setShowNotifications(false); }}
                  className="w-full text-center text-xs text-azure-400 hover:text-azure-300 font-medium py-1.5">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div ref={profileRef} className="relative ml-2">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs ring-2 ring-transparent hover:ring-indigo-300 transition-all"
          >
            {getInitials(user?.name || 'U')}
          </button>
          
          {showProfile && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-xl border border-border shadow-xl z-50 overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-border">
                <p className="font-semibold text-sm truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                <span className="inline-block mt-2 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold rounded-full uppercase">
                  {user?.role?.name}
                </span>
              </div>
              <div className="p-1">
                <button
                  onClick={() => {
                    setShowProfile(false);
                    if (user?.teamMemberId) navigate(`/members/${user.teamMemberId}`);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors"
                >
                  <UserIcon className="w-4 h-4 text-muted-foreground" />
                  My Profile
                </button>
                <button
                  onClick={() => {
                    setShowProfile(false);
                    navigate('/change-password');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  Change Password
                </button>
                <button
                  onClick={() => {
                    setShowProfile(false);
                    logout();
                    navigate('/login');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
