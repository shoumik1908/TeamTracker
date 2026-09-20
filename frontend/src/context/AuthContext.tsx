import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { queryClient } from '../lib/queryClient';
import { SESSION_EXPIRED_EVENT, authApi, getSessionToken, setSessionToken, type SessionExpiredDetail } from '../lib/api';

const INACTIVITY_TIMEOUT_MS = 12 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'sessionLastActivity';

interface Role {
  id: string;
  name: string;
  permissions: {
    read: boolean;
    write: boolean;
    delete: boolean;
    manageTeam: boolean;
    'tasks:manage'?: boolean;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
  teamMemberId: string | null;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  replaceSession: (token: string, user: User) => void;
  isLoading: boolean;
  hasPermission: (action: keyof Role['permissions'] | string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // TT-069: the session used to be restored from localStorage, which is exactly where
    // it should not have been — any script on the page could read the token. The durable
    // session is now an httpOnly cookie the browser sends on its own and JavaScript
    // cannot read, so the way to find out who is signed in is to ask the server.
    //
    // The cached user is still read first, purely so the shell can render without a
    // flash while /auth/me is in flight. It is not a credential: nothing is authorised
    // on the strength of it, and the server's answer replaces it either way.
    let cancelled = false;

    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch {
        // TT-135: a truncated entry must not stop the bootstrap; treat it as absent.
        localStorage.removeItem('user');
      }
    }

    authApi.getMe()
      .then(res => {
        if (cancelled) return;
        const me = (res.data as any)?.user;
        if (me) {
          setUser(me);
          localStorage.setItem('user', JSON.stringify(me));
          if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
            localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
          }
        } else {
          setUser(null);
          localStorage.removeItem('user');
        }
      })
      .catch(() => {
        // No cookie, or it is no longer valid: there is no session to restore.
        if (cancelled) return;
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    // TT-069: the token is held in memory only; the cookie the server just set is what
    // survives a reload. The user object is a render cache, not a credential.
    setSessionToken(newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setSessionToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    // The cookie is httpOnly, so only the server can clear it.
    authApi.logout().catch(() => { /* signing out locally must succeed regardless */ });
    // TT-068: the QueryClient outlives the session, so signing out left every cached
    // response in place — ['admin-users'], ['tasks'], ['current-user'], notifications.
    // On a shared machine the next person to sign in rendered the previous user's data
    // until each query refetched. Clearing is the only safe default: the cache has no
    // notion of who it belongs to.
    queryClient.clear();
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  /**
   * TT-129: ChangePasswordModal wrote the replacement token straight to localStorage,
   * so the context's `token` state kept the old value and the inactivity effect — which
   * is keyed on [token] — was never restarted. Replacing a credential is the context's
   * job, and it is the same work as login().
   */
  const replaceSession = (newToken: string, updatedUser: User) => {
    login(newToken, updatedUser);
  };

  const hasPermission = (action: keyof Role['permissions'] | string) => {
    if (!user) return false;
    const permissions = user.role.permissions as Record<string, boolean>;
    if (permissions.manageTeam === true) return true;
    return permissions[action] === true;
  };

  // The api client raises this when the server rejects our token — after a
  // secret rotation, an expiry, or a deactivated account. Without it the app
  // keeps rendering with a dead token and every request fails silently.
  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const rejected = (event as CustomEvent<SessionExpiredDetail>).detail?.token;
      // Ignore duplicates, and ignore a late failure belonging to a session the
      // user has already replaced by signing back in.
      // Ignore a late failure belonging to a session already replaced by signing back in.
      if (rejected && rejected !== getSessionToken()) return;
      logout();
      toast.error('Your session has expired. Please sign in again.');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  useEffect(() => {
    if (!token) {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      return;
    }

    const scheduleSignOut = (lastActivity: number) => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      const remaining = Math.max(0, INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivity));
      inactivityTimer.current = setTimeout(logout, remaining);
    };

    // TT-134: this ran on every scroll event — a synchronous localStorage write plus a
    // timer reschedule, many times per second during a single flick, each one also
    // broadcasting a storage event that made every other tab reschedule too. The
    // timeout is twelve minutes, so recording activity at most once every few seconds
    // loses nothing.
    let lastRecorded = 0;
    const ACTIVITY_THROTTLE_MS = 5000;

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastRecorded < ACTIVITY_THROTTLE_MS) return;
      lastRecorded = now;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      scheduleSignOut(now);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY && event.newValue) {
        scheduleSignOut(Number(event.newValue));
      }
      // TT-069: 'token' is no longer written, so cross-tab sign-out keys off the cached
      // user being cleared instead.
      if (event.key === 'user' && !event.newValue) logout();
    };

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, recordActivity, { passive: true }));
    window.addEventListener('storage', handleStorage);
    scheduleSignOut(Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now());

    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      events.forEach(event => window.removeEventListener(event, recordActivity));
      window.removeEventListener('storage', handleStorage);
    };
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, replaceSession, isLoading, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
