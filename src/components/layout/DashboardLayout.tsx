import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BaselinkerAutoSync } from '@/components/integrations/BaselinkerAutoSync';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Componente invisível para sincronização automática do Baselinker */}
      <BaselinkerAutoSync />

      <Sidebar />
      {/* Main content area with proper spacing for sidebar */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 w-full p-0">
          <div className="p-6 w-full h-full max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}