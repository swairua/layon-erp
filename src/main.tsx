import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { CompanyProvider } from '@/contexts/CompanyContext';
import { AuthErrorBoundary } from '@/components/auth/AuthErrorBoundary';
import { enableResizeObserverErrorSuppression } from '@/utils/resizeObserverErrorHandler';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx'
import './index.css'

// Suppress ResizeObserver errors before any components render
enableResizeObserverErrorSuppression();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <AuthErrorBoundary>
        <AuthProvider>
          <CompanyProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </CompanyProvider>
        </AuthProvider>
      </AuthErrorBoundary>
    </HelmetProvider>
  </QueryClientProvider>
);
