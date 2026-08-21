import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ChatBot from '../chat/ChatBot';
import SessionReminderToasts from '../coe/SessionReminderToasts';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/members': 'Team Members',
  '/certifications': 'Certification Catalog',
  '/tracker': 'Certification Tracker',
  '/projects': 'Project Management',
  '/deadlines': 'Deadline Tracker',
  '/notifications': 'Notifications',
  '/reports': 'Reports & Export',
  '/coe': 'Centre of Excellence',
};

export default function Layout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    key === '/' ? location.pathname === '/' : location.pathname.startsWith(key)
  )?.[1] || 'Xebia Team Tracker';

  return (
    <div className="flex h-screen overflow-hidden bg-transparent relative z-10">
      <div className="absolute top-0 right-0 w-[900px] h-[700px] bg-[radial-gradient(circle_at_50%_0%,rgba(149,60,181,0.10)_0%,rgba(247,245,251,0)_68%)] pointer-events-none" />
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-transparent w-full">
          <Outlet />
        </main>
      </div>
      <ChatBot />
      <SessionReminderToasts />
    </div>
  );
}
