import { useEffect } from 'react';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { useIsSalesAccount } from '@/contexts/AuthContext';
import SEO from '@/components/SEO';

const Index = () => {
  const { isSalesAccount, isLoading } = useIsSalesAccount();

  useEffect(() => {
    console.log('📊 Dashboard - isSalesAccount:', isSalesAccount, 'isLoading:', isLoading);
  }, [isSalesAccount, isLoading]);


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
