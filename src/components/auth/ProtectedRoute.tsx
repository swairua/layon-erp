import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireAuth?: boolean;
}

export function ProtectedRoute({
  children,
  fallback,
  requireAuth = true,
}: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const [sessionVerified, setSessionVerified] = useState(false);
  const [verifyingSession, setVerifyingSession] = useState(false);

  useEffect(() => {
    // If context says we're authenticated, no need to verify
    if (isAuthenticated) {
      setSessionVerified(true);
      return;
    }

    // If still loading, wait for initial load
    if (loading) {
      return;
    }

    // If loading is complete and we're not authenticated, verify Supabase session as fallback
    const verifySuperbaseSession = async () => {
      setVerifyingSession(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('✅ [ProtectedRoute] Session verified via Supabase fallback');
          setSessionVerified(true);
        }
      } catch (error) {
        console.error('[ProtectedRoute] Error verifying session:', error);
      } finally {
        setVerifyingSession(false);
      }
    };

    verifySuperbaseSession();
  }, [isAuthenticated, loading]);

  // Show loading state while checking session
  if (loading || verifyingSession) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Check authentication: context state OR verified session
  if (requireAuth && !isAuthenticated && !sessionVerified) {
    return fallback || (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
            <p className="text-muted-foreground mb-4">
              Please sign in to access this page.
            </p>
            <Button onClick={() => window.location.reload()}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

// Higher-order component for protecting routes
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  protection: Omit<ProtectedRouteProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute {...protection}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}
