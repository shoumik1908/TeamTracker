import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ChatBot from '../chat/ChatBot';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/members': 'Team Members',
  '/certifications': 'Certification Catalog',
  '/tracker': 'Certification Tracker',
  '/projects': 'Project Management',
  '/deadlines': 'Deadline Tracker',
  '/notifications': 'Notifications',
  '/reports': 'Reports & Export',
};

export default function Layout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    key === '/' ? location.pathname === '/' : location.pathname.startsWith(key)
  )?.[1] || 'Team Tracker';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen} 
      />
      <div className="flex-1 flex flex-col overflow-hidden w-full relative">
        <Header 
          title={title} 
          isMobileMenuOpen={isMobileMenuOpen} 
          setIsMobileMenuOpen={setIsMobileMenuOpen} 
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background w-full">
          <Outlet />
        </main>
      </div>
      <ChatBot />
    </div>
  );
}
