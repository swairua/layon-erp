import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Building2,
  Package,
  DollarSign,
  Settings,
  ChevronDown,
  ChevronRight,
  Home,
  Users,
  CreditCard,
  FileSpreadsheet,
  ShoppingCart,
  Receipt,
  FileText,
  Truck,
  History,
  X,
} from 'lucide-react';
import { BiolegendLogo } from '@/components/ui/biolegend-logo';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { useIsSalesAccount } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface SidebarItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  children?: SidebarItem[];
}

const sidebarItems: SidebarItem[] = [
  {
    title: 'Dashboard',
    icon: Home,
    href: '/'
  },
  {
    title: 'Customers',
    icon: Users,
    href: '/customers'
  },
  {
    title: 'Products',
    icon: Package,
    href: '/inventory'
  },
  {
    title: 'Sales',
    icon: ShoppingCart,
    children: [
      { title: 'Quotations', icon: FileText, href: '/quotations' },
      { title: 'Invoices', icon: Receipt, href: '/invoices' },
      { title: 'Delivery Notes', icon: Truck, href: '/delivery-notes' },
      { title: 'Cash Receipts', icon: Receipt, href: '/cash-receipts' }
    ]
  },
  {
    title: 'BOQs',
    icon: FileSpreadsheet,
    href: '/boqs'
  },
  {
    title: 'Fixed BOQ',
    icon: FileSpreadsheet,
    href: '/fixed-boq'
  },
  {
    title: 'LCL Template',
    icon: FileSpreadsheet,
    href: '/lcl-template'
  },
  {
    title: 'LCL BOQ List',
    icon: FileSpreadsheet,
    href: '/lcl-boq-list'
  },
  {
    title: 'Payments',
    icon: DollarSign,
    children: [
      { title: 'Payments', icon: DollarSign, href: '/payments' }
    ]
  },
  {
    title: 'Audit Logs',
    icon: History,
    href: '/audit-logs'
  },
  {
    title: 'Settings',
    icon: Settings,
    children: [
      { title: 'Company Settings', icon: Building2, href: '/settings/company' },
      { title: 'User Management', icon: Users, href: '/settings/users' }
    ]
  }
];

interface SidebarProps {
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isMobile = false, isOpen = true, onClose = () => {} }: SidebarProps) {
  const location = useLocation();
  const { currentCompany } = useCurrentCompany();
  const { isSalesAccount, isLoading } = useIsSalesAccount();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Filter sidebar items based on user role
  const filteredSidebarItems = useMemo(() => {
    return sidebarItems.filter(item => {
      // Hide these items for sales accounts (apply filter immediately, don't wait for loading)
      if (isSalesAccount && ['Payments', 'Audit Logs', 'Settings'].includes(item.title)) {
        return false;
      }
      return true;
    });
  }, [isSalesAccount]);

  useEffect(() => {
    console.log('🔍 Sidebar - isSalesAccount:', isSalesAccount, 'isLoading:', isLoading);
    console.log('📋 Sidebar filtered items:', filteredSidebarItems.map(item => item.title));
  }, [isSalesAccount, filteredSidebarItems, isLoading]);

  const toggleExpanded = (title: string) => {
    setExpandedItems(prev => 
      prev.includes(title) 
        ? prev.filter(item => item !== title)
        : [...prev, title]
    );
  };

  const isItemActive = (href?: string) => {
    if (!href) return false;
    return location.pathname === href;
  };

  const isParentActive = (children?: SidebarItem[]) => {
    if (!children) return false;
    return children.some(child => isItemActive(child.href));
  };

  const renderSidebarItem = (item: SidebarItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.title);
    const isActive = isItemActive(item.href);
    const isChildActive = isParentActive(item.children);

    if (hasChildren) {
      return (
        <div key={item.title} className="space-y-1">
          <button
            onClick={() => toggleExpanded(item.title)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-smooth hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              (isChildActive || isExpanded) 
                ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                : "text-sidebar-foreground"
            )}
          >
            <div className="flex items-center space-x-3">
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          
          {isExpanded && (
            <div className="pl-4 space-y-1">
              {item.children?.map(child => (
                <Link
                  key={child.title}
                  to={child.href!}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 text-sm rounded-lg transition-smooth hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isItemActive(child.href)
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground"
                  )}
                >
                  <child.icon className="h-4 w-4" />
                  <span>{child.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.title}
        to={item.href!}
        className={cn(
          "flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-smooth hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground"
        )}
      >
        <item.icon className="h-5 w-5" />
        <span>{item.title}</span>
      </Link>
    );
  };

  if (isMobile) {
    return (
      <div
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out transform",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Company Logo/Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
          <BiolegendLogo size="lg" showText={true} className="text-sidebar-foreground" />
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 p-4 custom-scrollbar overflow-y-auto">
          {filteredSidebarItems.map(item => (
            <div key={item.title} onClick={onClose}>
              {renderSidebarItem(item)}
            </div>
          ))}
        </nav>

        {/* Company Info */}
        <div className="border-t border-sidebar-border p-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-3 px-3 py-2 text-sm text-sidebar-foreground">
              <Building2 className="h-4 w-4 text-sidebar-primary" />
              <div className="min-w-0">
                <div className="font-medium truncate">{currentCompany?.name || 'Company'}</div>
                <div className="text-xs text-sidebar-foreground/60 truncate">{currentCompany?.city || currentCompany?.country || 'Management'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Company Logo/Header */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <BiolegendLogo size="lg" showText={true} className="text-sidebar-foreground" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 p-4 custom-scrollbar overflow-y-auto">
        {filteredSidebarItems.map(renderSidebarItem)}
      </nav>

      {/* Company Info */}
      <div className="border-t border-sidebar-border p-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-3 px-3 py-2 text-sm text-sidebar-foreground">
            <Building2 className="h-4 w-4 text-sidebar-primary" />
            <div className="min-w-0">
              <div className="font-medium truncate">{currentCompany?.name || 'Company'}</div>
              <div className="text-xs text-sidebar-foreground/60 truncate">{currentCompany?.city || currentCompany?.country || 'Management'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
