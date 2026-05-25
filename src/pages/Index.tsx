import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { DashboardSummaryCards } from '@/components/dashboard/DashboardSummaryCards';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { useCompanies } from '@/hooks/useDatabase';
import { useIsSalesAccount } from '@/contexts/AuthContext';
import SEO from '@/components/SEO';

const Index = () => {
  const navigate = useNavigate();
  const { isSalesAccount, isLoading } = useIsSalesAccount();
  const { data: companies } = useCompanies();

  useEffect(() => {
    if (!isLoading) {
      console.log('📊 Dashboard - isSalesAccount:', isSalesAccount, 'isLoading:', isLoading);
      console.log('📊 Dashboard - DashboardStats visible:', !isSalesAccount, 'DashboardSummaryCards visible:', !isSalesAccount);
    }
  }, [isLoading, isSalesAccount]);

  const handleDrillDown = (module: string, filterType: string) => {
    // Navigate to the appropriate module with filter state
    switch (module) {
      case 'quotations':
        navigate(`/quotations?status=${filterType}`);
        break;
      case 'boqs':
        navigate(`/boqs?dueStatus=${filterType}`);
        break;
      case 'invoices':
        navigate(`/invoices?dueStatus=${filterType}`);
        break;
      case 'proforma':
        navigate(`/proforma?status=${filterType}`);
        break;
      case 'payments':
        navigate(`/payments?filter=${filterType}`);
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-6">
      <SEO
        title="Dashboard"
        description="View your business performance, recent activities, and manage your companies from one place."
      />
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's what's happening with your business today.
        </p>
      </div>

      {/* Dashboard Stats - only show when profile is loaded and not a sales account */}
      {!isLoading && !isSalesAccount && <DashboardStats />}

      {/* Dashboard Summary Cards with Drill-down - only show when profile is loaded and not a sales account */}
      {!isLoading && !isSalesAccount && <DashboardSummaryCards onDrill={handleDrillDown} />}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Takes 2/3 of the space */}
        <div className="lg:col-span-2 space-y-6">
          <RecentActivity />
        </div>

        {/* Right Column - Takes 1/3 of the space */}
        <div className="space-y-6">
          <QuickActions />
        </div>
      </div>
    </div>
  );
};

export default Index;
