import { ReactNode } from 'react';
import { Sidebar, MobileTopBar } from './Sidebar';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Desktop sidebar (hidden on mobile) */}
      <Sidebar />

      {/* Content column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Mobile top bar with drawer (hidden on desktop) */}
        <MobileTopBar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
