'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import { DesktopOnlyWrapper } from '@/components/DesktopOnlyWrapper';
import { Loader2 } from 'lucide-react';

export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Login page - render without sidebar
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Not logged in - AuthProvider will redirect, just show loading
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Authenticated - show full layout with sidebar
  return (
    <DesktopOnlyWrapper>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full">
          <DashboardSidebar />
          <SidebarInset>
            <div className="flex-1 flex flex-col">
              {children}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </DesktopOnlyWrapper>
  );
}
