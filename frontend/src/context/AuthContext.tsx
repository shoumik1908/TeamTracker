import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

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
    // Load from localStorage on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const hasPermission = (action: keyof Role['permissions'] | string) => {
    if (!user) return false;
    const permissions = user.role.permissions as Record<string, boolean>;
    if (permissions.manageTeam === true) return true;
    return permissions[action] === true;
  };

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

    const recordActivity = () => {
      const now = Date.now();
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      scheduleSignOut(now);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY && event.newValue) {
        scheduleSignOut(Number(event.newValue));
      }
      if (event.key === 'token' && !event.newValue) logout();
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
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isLoading, hasPermission }}>
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
