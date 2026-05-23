import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { parseErrorMessage } from '@/utils/errorHelpers';
import { RecordPaymentModal } from '@/components/payments/RecordPaymentModal';
import { ViewPaymentModal } from '@/components/payments/ViewPaymentModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { usePagination } from '@/hooks/usePagination';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  Filter,
  Eye,
  DollarSign,
  Download,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { usePayments, useCompanies, useDeletePayment } from '@/hooks/useDatabase';
import { useInvoicesFixed as useInvoices } from '@/hooks/useInvoicesFixed';
import { useAuth } from '@/contexts/AuthContext';
import { generatePaymentReceiptPDF } from '@/utils/pdfGenerator';
import { formatCurrency as formatCurrencyUtil } from '@/utils/currencyFormatter';

interface Payment {
  id: string;
  payment_number: string;
  customer_id: string;
  payment_date: string;
  amount: number;
  payment_method: 'cash' | 'mpesa' | 'bank_transfer' | 'cheque';
  reference_number?: string;
  notes?: string;
  customers?: {
    name: string;
    email?: string;
  };
  payment_allocations?: {
    id: string;
    invoice_number: string;
    allocated_amount: number;
    invoice_total: number;
    paid_amount?: number;
    balance_due?: number;
  }[];
}

function getStatusColor() {
  return 'bg-success-light text-success border-success/20'; // All payments are completed when recorded
}

function getMethodColor(method: string) {
  switch (method) {
    case 'cash':
      return 'bg-success-light text-success border-success/20';
    case 'mpesa':
      return 'bg-primary-light text-primary border-primary/20';
    case 'bank_transfer':
      return 'bg-primary-light text-primary border-primary/20';
    case 'cheque':
      return 'bg-warning-light text-warning border-warning/20';
    default:
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
  }
}

function formatCurrency(amount: number, currency: string = 'KES') {
  return formatCurrencyUtil(amount, currency);
}

export default function Payments() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null);

  const isSalesAccount = profile?.email?.toLowerCase() === 'sales@layonsconstruction.com';

  if (isSalesAccount) {
    return (
      <div className="space-y-6 p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-900">
            You don't have permission to access Payments.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">
              You don't have permission to view or manage payments. Please contact your administrator if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Set method filter from URL params
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter && ['all', 'thisMonth', 'cash', 'mpesa', 'bank_transfer', 'cheque'].includes(filter)) {
      setMethodFilter(filter);
    }
  }, [searchParams]);

  // Fetch live payments data and company details
  const { data: companies = [] } = useCompanies();
  const currentCompany = companies.length > 0 ? companies[0] : undefined;
  const { data: payments = [], isLoading, error } = usePayments(currentCompany?.id);
  const { data: invoices = [] } = useInvoices(currentCompany?.id);
  const deletePayment = useDeletePayment();


  const handleRecordPayment = () => {
    setShowRecordModal(true);
  };

  const handleViewPayment = (payment: Payment) => {
    // Payment data is already in the correct format from the database
    setSelectedPayment(payment);
    setShowViewModal(true);
  };

  const handleDeleteClick = (payment: Payment) => {
    setPaymentToDelete(payment);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!paymentToDelete || !currentCompany?.id) {
      toast.error('Missing required information for deletion');
      return;
    }

    try {
      console.log('Initiating payment deletion:', paymentToDelete.id);
      await deletePayment.mutateAsync({
        paymentId: paymentToDelete.id,
        companyId: currentCompany.id
      });
      toast.success(`Payment ${paymentToDelete.payment_number} deleted successfully`);
      setShowDeleteConfirm(false);
      setPaymentToDelete(null);
    } catch (error) {
      console.error('Delete error caught:', error);

      let errorMessage = 'Unknown error occurred';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = (error as any)?.message || JSON.stringify(error);
      }

      // Clean up any [object Object] messages
      if (errorMessage.includes('[object Object]')) {
        errorMessage = 'Failed to delete payment. Please try again or contact support.';
      }

      toast.error(errorMessage, {
        duration: 6000
      });
    }
  };

  const handleDownloadReceipt = (payment: Payment) => {
    try {
      // Debug: Log the payment data
      console.log('Payment data for receipt:', {
        payment_number: payment.payment_number,
        payment_allocations: payment.payment_allocations,
        allocations_count: payment.payment_allocations?.length || 0
      });

      if (!payment.payment_allocations || payment.payment_allocations.length === 0) {
        toast.warning('No invoices associated with this payment. Receipt will be generated without invoice particulars.');
      }

      // Enrich payment data with invoice balance information
      const enrichedPayment = {
        ...payment,
        payment_allocations: payment.payment_allocations?.map(alloc => {
          // Find the corresponding invoice to get balance information
          const invoice = invoices.find(inv => inv.invoice_number === alloc.invoice_number);

          // Calculate previous balance (balance before this payment)
          const currentBalanceDue = invoice?.balance_due || 0;
          const previousBalance = currentBalanceDue + alloc.allocated_amount;

          // Calculate due amount after this payment
          const dueAmount = Math.max(0, previousBalance - alloc.allocated_amount);

          const enrichedAlloc = {
            ...alloc,
            paid_amount: invoice?.paid_amount || 0,
            balance_due: invoice?.balance_due || 0,
            previous_balance: previousBalance,
            due_amount: dueAmount
          };

          console.log('Enriched allocation:', enrichedAlloc);
          return enrichedAlloc;
        }) || []
      };

      console.log('Enriched payment for PDF:', enrichedPayment);

      // Use the utility function with company details
      const companyDetails = currentCompany ? {
        name: currentCompany.name,
        address: currentCompany.address,
        city: currentCompany.city,
        country: currentCompany.country,
        phone: currentCompany.phone,
        email: currentCompany.email,
        tax_number: currentCompany.tax_number,
        logo_url: currentCompany.logo_url,
        header_image: currentCompany.header_image,
        stamp_image: currentCompany.stamp_image,
        company_services: currentCompany.company_services
      } : undefined;

      generatePaymentReceiptPDF(enrichedPayment, companyDetails);
      toast.success(`Receipt downloaded for payment ${payment.payment_number}`);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast.error('Failed to download receipt. Please try again.');
    }
  };

  // Removed inline PDF generation function - now using utility function

  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      (payment.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (payment.payment_number?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (payment.payment_allocations?.some(alloc => alloc.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())) ?? false);

    let matchesFilter = true;
    if (methodFilter === 'all') {
      matchesFilter = true;
    } else if (methodFilter === 'thisMonth') {
      const paymentDate = new Date(payment.payment_date);
      const now = new Date();
      matchesFilter = paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
    } else {
      matchesFilter = payment.payment_method === methodFilter;
    }

    return matchesSearch && matchesFilter;
  });

  // Pagination hook
  const pagination = usePagination(filteredPayments, { initialPageSize: 10 });
  const paginatedPayments = pagination.paginatedItems;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payments</h1>
            <p className="text-muted-foreground">Loading payment data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMsg = parseErrorMessage(error);
    const isNetworkError = errorMsg?.toLowerCase().includes('network') ||
                          errorMsg?.toLowerCase().includes('failed to fetch') ||
                          errorMsg?.toLowerCase().includes('unable to connect');

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          </div>
        </div>

        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-destructive mb-1">
                    {isNetworkError ? 'Connection Error' : 'Error Loading Payments'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {errorMsg}
                  </p>

                  {isNetworkError && (
                    <div className="bg-background border border-muted rounded-md p-3 text-sm space-y-2">
                      <p className="font-medium text-foreground">Troubleshooting steps:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Check your internet connection</li>
                        <li>Try refreshing the page (Ctrl+R or Cmd+R)</li>
                        <li>Clear your browser cache</li>
                        <li>Wait a moment and try again</li>
                        <li>If the problem persists, Supabase service may be temporarily unavailable</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Retry Loading Payments
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    );
  }

  // Calculate stats from live data
  const totalReceivedToday = payments
    .filter(p => new Date(p.payment_date).toDateString() === new Date().toDateString())
    .reduce((sum, p) => sum + p.amount, 0);
  
  const totalThisMonth = payments
    .filter(p => {
      const paymentDate = new Date(p.payment_date);
      const now = new Date();
      return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, p) => sum + p.amount, 0);
  
  const completedThisMonth = payments
    .filter(p => {
      const paymentDate = new Date(p.payment_date);
      const now = new Date();
      return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
    }).length;
  
  const pendingAmount = 0; // All payments in system are completed when recorded

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground">
            Track and manage customer payments (All amounts in KES)
          </p>
        </div>
        <Button className="gradient-primary text-primary-foreground hover:opacity-90 shadow-card" size="lg" onClick={handleRecordPayment}>
          <Plus className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </div>


      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Received Today</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totalReceivedToday)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Badge className="bg-success-light text-success">{completedThisMonth}</Badge>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed This Month</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totalThisMonth)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Badge className="bg-warning-light text-warning">0</Badge>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-warning">{formatCurrency(pendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['all', 'cash', 'mpesa', 'bank_transfer'].map((method) => {
          let count = 0;
          let label = method;
          if (method === 'all') {
            count = payments.length;
            label = 'All Payments';
          } else if (method === 'mpesa') {
            count = payments.filter(p => p.payment_method === 'mpesa').length;
            label = 'M-Pesa';
          } else if (method === 'bank_transfer') {
            count = payments.filter(p => p.payment_method === 'bank_transfer').length;
            label = 'Bank Transfer';
          } else {
            count = payments.filter(p => p.payment_method === method).length;
            label = method.charAt(0).toUpperCase() + method.slice(1);
          }
          const isActive = methodFilter === method;
          return (
            <Card
              key={method}
              className={`shadow-card cursor-pointer hover:shadow-lg transition-shadow ${isActive ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setMethodFilter(isActive ? 'all' : method)}
            >
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{isActive ? 'Filtering...' : 'Click to filter'}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters and Search */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search payments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No payments found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? 'Try adjusting your search criteria'
                  : 'Record your first payment to get started'
                }
              </p>
              {!searchTerm && (
                <Button onClick={handleRecordPayment}>
                  <Plus className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount (KES)</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{payment.payment_number}</TableCell>
                      <TableCell>{payment.customers?.name || 'N/A'}</TableCell>
                      <TableCell className="font-medium text-primary">
                        {payment.payment_allocations?.[0]?.invoice_number || 'N/A'}
                      </TableCell>
                      <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-semibold text-success">{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getMethodColor(payment.payment_method)}>
                          {payment.payment_method.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor()}>
                          Completed
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewPayment(payment)}
                            title="View payment details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadReceipt(payment)}
                            title="Download receipt"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(payment)}
                            title="Delete payment"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={deletePayment.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                pageSize={pagination.pageSize}
                totalItems={pagination.totalItems}
                onPageChange={pagination.setCurrentPage}
                onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        open={showRecordModal}
        onOpenChange={setShowRecordModal}
        onSuccess={() => {
          setShowRecordModal(false);
          toast.success('Payment recorded successfully!');
        }}
        invoice={undefined} // For standalone payment recording
      />



      {/* View Payment Modal */}
      <ViewPaymentModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        payment={selectedPayment}
        onDownloadReceipt={handleDownloadReceipt}
        onSendReceipt={(payment) => toast.info(`Sending receipt for payment ${payment.payment_number}`)}
      />

      {/* Delete Payment Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete payment {paymentToDelete?.payment_number}? This will reverse all allocations and update invoice balances. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deletePayment.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePayment.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
