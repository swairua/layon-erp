import { createContext, useContext, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCompanies } from '@/hooks/useDatabase';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyContextType {
  currentCompany: any | null;
  isLoading: boolean;
  error: Error | null;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { data: companies, isLoading, error } = useCompanies();

  // Invalidate companies query when auth becomes active
  // This handles the case where useCompanies cached an error from pre-login attempts
  useEffect(() => {
    if (isAuthenticated) {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    }
  }, [isAuthenticated, queryClient]);
  const defaultCompanyId = import.meta.env.VITE_DEFAULT_COMPANY_ID?.trim();
  const defaultCompanyName = import.meta.env.VITE_DEFAULT_COMPANY_NAME?.trim().toLowerCase();

  const currentCompany = useMemo(() => {
    if (!companies || companies.length === 0) {
      return null;
    }

    if (defaultCompanyId) {
      const matchById = companies.find(company => company.id === defaultCompanyId);
      if (matchById) {
        console.log('[CompanyContext] Selected by VITE_DEFAULT_COMPANY_ID:', matchById);
        return matchById;
      }
    }

    if (defaultCompanyName) {
      const matchByName = companies.find(company => company.name?.toLowerCase() === defaultCompanyName);
      if (matchByName) {
        console.log('[CompanyContext] Selected by VITE_DEFAULT_COMPANY_NAME:', matchByName);
        return matchByName;
      }
    }

    console.log('[CompanyContext] Selected companies[0]:', companies[0]);
    return companies[0];
  }, [companies, defaultCompanyId, defaultCompanyName]);

  return (
    <CompanyContext.Provider value={{ currentCompany, isLoading, error }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCurrentCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCurrentCompany must be used within a CompanyProvider');
  }
  return context;
}

export function useCurrentCompanyId() {
  const { currentCompany } = useCurrentCompany();
  return currentCompany?.id;
}
