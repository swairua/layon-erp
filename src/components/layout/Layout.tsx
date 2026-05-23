import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/contexts/AuthContext';
import { EnhancedLogin } from '@/components/auth/EnhancedLogin';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [loadingStartTime] = useState(Date.now());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Routes that don't require authentication
  const publicRoutes = ['/auth-test', '/manual-setup', '/database-fix-page', '/auto-fix', '/audit', '/auto-payment-sync', '/payment-sync', '/admin-recreate'];
  const isPublicRoute = publicRoutes.includes(location.pathname);

  // Show login after initial auth completes to avoid redirect bounce
  if (!loading && !isAuthenticated && !isPublicRoute) {
    return <EnhancedLogin />;
  }

  if (loading && isAuthenticated) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">App appears to be stuck in loading state...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mt-4"></div>
        </div>
      </div>
    );
  }

  // Show loading spinner if loading and no authentication state yet
  if (loading) {
    const loadingDuration = Math.floor((Date.now() - loadingStartTime) / 1000);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-2 w-full max-w-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium text-foreground">Starting up...</p>
          <p className="text-sm text-muted-foreground">This should only take a moment</p>
          {loadingDuration > 2 && (
            <p className="text-sm text-muted-foreground mt-2">Almost ready...</p>
          )}
        </div>
      </div>
    );
  }

  // Show simple layout for public routes
  if (isPublicRoute) {
    return (
      <div className="min-h-screen bg-background">
        <main className="w-full">
          {children}
        </main>
      </div>
    );
  }

  // Show authenticated layout
  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar isMobile={false} isOpen={true} onClose={() => {}} />
      </div>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="md:hidden">
        <Sidebar
          isMobile={true}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
