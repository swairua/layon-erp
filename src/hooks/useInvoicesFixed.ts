import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fixed hook for fetching invoices with customer data
 * Uses separate queries to avoid relationship ambiguity
 */
export const useInvoicesFixed = (companyId?: string) => {
  return useQuery({
    queryKey: ['invoices_fixed', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      try {
        console.log('Fetching invoices for company:', companyId);

        // Check authentication status
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.warn('No active session - user may not be authenticated');
          throw new Error('Authentication required: No active session');
        }
        console.log('✅ Session verified for user:', session.user?.email);

        // Step 1: Get invoices without embedded relationships
        // Note: Use paid_amount and balance_due as per the database schema
        let query = supabase
          .from('invoices')
          .select(`
            id,
            customer_id,
            invoice_number,
            invoice_date,
            due_date,
            status,
            subtotal,
            tax_amount,
            total_amount,
            paid_amount,
            balance_due,
            notes,
            terms_and_conditions,
            lpo_number,
            created_at,
            updated_at
          `)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        const { data: invoices, error: invoicesError } = await query;

        if (invoicesError) {
          const errorMsg = invoicesError?.message || JSON.stringify(invoicesError);
          console.error('Error fetching invoices from Supabase:', {
            message: errorMsg,
            code: (invoicesError as any)?.code,
            status: (invoicesError as any)?.status,
            fullError: invoicesError
          });
          throw new Error(`Failed to fetch invoices: ${errorMsg}`);
        }

        console.log('Invoices fetched successfully:', invoices?.length || 0);

        if (!invoices || invoices.length === 0) {
          return [];
        }

        // Step 2: Get unique customer IDs (filter out invalid UUIDs)
        const customerIds = [...new Set(invoices.map(invoice => invoice.customer_id).filter(id => id && typeof id === 'string' && id.length === 36))];
        console.log('Fetching customer data for IDs:', customerIds.length);

        // Step 3: Get customers separately
        const { data: customers, error: customersError } = customerIds.length > 0 ? await supabase
          .from('customers')
          .select('id, name, email, phone, address, city, country')
          .in('id', customerIds) : { data: [], error: null };

        if (customersError) {
          console.error('Error fetching customers (non-fatal):', customersError);
          // Don't throw here, just continue without customer data
        }

        console.log('Customers fetched:', customers?.length || 0);

        // Step 4: Create customer lookup map
        const customerMap = new Map();
        (customers || []).forEach(customer => {
          customerMap.set(customer.id, customer);
        });

        // Step 4a: Get company details
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('id, name, address, city, country, phone, email, tax_number')
          .eq('id', companyId)
          .single();

        if (companyError) {
          console.error('Error fetching company (non-fatal):', companyError);
        }

        // Step 5: Get invoice items for each invoice
        const invoiceIds = invoices.map(inv => inv.id).filter(id => id && typeof id === 'string');

        // Helper to retry a Supabase query in case of transient network errors
        async function queryInvoiceItemsWithRetry(ids: string[], attempts = 3, delayMs = 500) {
          // Validate input before attempting query
          if (!ids || ids.length === 0) {
            console.log('No invoice IDs to fetch items for');
            return { data: [], error: null };
          }

          for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
              console.log(`Fetching invoice items - attempt ${attempt}/${attempts} for ${ids.length} invoices`);
              const res = await supabase
                .from('invoice_items')
                .select(`
                  id,
                  invoice_id,
                  product_id,
                  description,
                  quantity,
                  unit_price,
                  discount_percentage,
                  discount_before_vat,
                  tax_percentage,
                  tax_amount,
                  tax_inclusive,
                  line_total,
                  sort_order,
                  section_name,
                  section_labor_cost,
                  unit_of_measure,
                  products(id, name, product_code, unit_of_measure)
                `)
                .in('invoice_id', ids);

              if (res.error) {
                console.warn(`Attempt ${attempt} returned error:`, res.error);
                if (attempt < attempts) {
                  await new Promise(r => setTimeout(r, delayMs * attempt));
                  continue;
                }
              }
              return res;
            } catch (err) {
              console.warn(`Attempt ${attempt} to fetch invoice_items failed with exception:`, err);
              if (attempt < attempts) {
                // small backoff before retrying
                await new Promise(r => setTimeout(r, delayMs * attempt));
                continue;
              }
              // On last attempt, return with no data instead of throwing
              console.error(`Failed to fetch invoice items after ${attempts} attempts:`, err);
              return { data: [], error: err };
            }
          }
          return { data: [], error: null };
        }

        let invoiceItems = [] as any[];
        try {
          if (invoiceIds.length > 0) {
            const { data, error } = await queryInvoiceItemsWithRetry(invoiceIds, 3, 500);
            if (error) {
              console.error('Error fetching invoice items (non-fatal):', (error as any)?.message || error);
            } else if (data && data.length > 0) {
              invoiceItems = data;
              console.log('✅ Invoice items fetched:', invoiceItems.length);
            } else if (data) {
              console.log('No invoice items found for these invoices');
            }
          } else {
            console.log('No valid invoice IDs to fetch items for');
          }
        } catch (err) {
          console.error('Unexpected error fetching invoice items (non-fatal):', err);
          // Leave invoiceItems as empty array so invoices still load
        }

        // Step 6: Group invoice items by invoice_id
        const itemsMap = new Map();
        (invoiceItems || []).forEach(item => {
          if (!itemsMap.has(item.invoice_id)) {
            itemsMap.set(item.invoice_id, []);
          }
          itemsMap.get(item.invoice_id).push(item);
        });

        // Step 6a: Fetch payment allocations for each invoice
        let paymentAllocations = [] as any[];
        try {
          if (invoiceIds.length > 0) {
            const { data, error } = await supabase
              .from('payment_allocations')
              .select(`
                id,
                invoice_id,
                payment_id,
                amount_allocated,
                payments(
                  id,
                  payment_number,
                  payment_date,
                  amount,
                  payment_method,
                  reference_number
                )
              `)
              .in('invoice_id', invoiceIds);

            if (error) {
              console.error('Error fetching payment allocations (non-fatal):', (error as any)?.message || error);
            } else if (data) {
              paymentAllocations = data;
              console.log('✅ Payment allocations fetched:', paymentAllocations.length);
            }
          }
        } catch (err) {
          console.error('Unexpected error fetching payment allocations (non-fatal):', err);
        }

        // Group payment allocations by invoice_id
        const allocationsMap = new Map();
        (paymentAllocations || []).forEach(alloc => {
          if (!allocationsMap.has(alloc.invoice_id)) {
            allocationsMap.set(alloc.invoice_id, []);
          }
          allocationsMap.get(alloc.invoice_id).push(alloc);
        });

        // Step 7: Combine data with enriched information
        const enrichedInvoices = invoices.map(invoice => ({
          ...invoice,
          customers: customerMap.get(invoice.customer_id) || {
            name: 'Unknown Customer',
            email: null,
            phone: null
          },
          company: company || null,
          invoice_items: itemsMap.get(invoice.id) || [],
          payment_allocations: allocationsMap.get(invoice.id) || []
        }));

        console.log('✅ Invoices enriched successfully:', enrichedInvoices.length);
        enrichedInvoices.forEach(inv => {
          console.log(`  📦 Invoice ${inv.invoice_number}:`, {
            id: inv.id,
            idType: typeof inv.id,
            idLength: inv.id?.length,
            items: inv.invoice_items.length
          });
        });
        return enrichedInvoices;

      } catch (error) {
        console.error('Error in useInvoicesFixed:', error);
        throw error;
      }
    },
    enabled: !!companyId,
    staleTime: 30000, // Cache for 30 seconds
    retry: 3,
    retryDelay: 1000,
  });
};

/**
 * Hook for fetching customer invoices (for a specific customer)
 */
export const useCustomerInvoicesFixed = (customerId?: string, companyId?: string) => {
  return useQuery({
    queryKey: ['customer_invoices_fixed', customerId, companyId],
    queryFn: async () => {
      if (!customerId) return [];

      try {
        console.log('Fetching invoices for customer:', customerId);

        // Get invoices for specific customer
        // Note: Use paid_amount and balance_due as per the database schema
        // Note: company_id column may not exist; filtering by company happens via customer relationship
        const { data: invoices, error: invoicesError } = await supabase
          .from('invoices')
          .select(`
            id,
            customer_id,
            invoice_number,
            invoice_date,
            due_date,
            status,
            subtotal,
            tax_amount,
            total_amount,
            paid_amount,
            balance_due,
            notes,
            terms_and_conditions,
            lpo_number,
            created_at,
            updated_at
          `)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false });

        if (invoicesError) {
          console.error('Error fetching customer invoices:', invoicesError);
          throw new Error(`Failed to fetch customer invoices: ${invoicesError.message}`);
        }

        if (!invoices || invoices.length === 0) {
          return [];
        }

        // Get customer data (including company_id to fetch company details)
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('id, name, email, phone, address, city, country, company_id')
          .eq('id', customerId)
          .single();

        if (customerError) {
          console.error('Error fetching customer:', customerError);
        }

        // Get company details through customer relationship
        let company = null;
        if (customer && customer.company_id) {
          try {
            const { data: companyData, error: companyError } = await supabase
              .from('companies')
              .select('id, name, address, city, country, phone, email, tax_number')
              .eq('id', customer.company_id)
              .single();

            if (companyError) {
              console.error('Error fetching company (non-fatal):', companyError);
            } else {
              company = companyData;
            }
          } catch (err) {
            console.error('Error fetching company (non-fatal):', err);
          }
        }

        // Get invoice items
        const invoiceIds = invoices.map(inv => inv.id);

        async function queryInvoiceItemsWithRetry(attempts = 3, delayMs = 500) {
          for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
              const res = await supabase
                .from('invoice_items')
                .select(`
                  id,
                  invoice_id,
                  product_id,
                  description,
                  quantity,
                  unit_price,
                  discount_percentage,
                  discount_before_vat,
                  tax_percentage,
                  tax_amount,
                  tax_inclusive,
                  line_total,
                  sort_order,
                  section_name,
                  section_labor_cost,
                  unit_of_measure,
                  products(id, name, product_code, unit_of_measure)
                `)
                .in('invoice_id', invoiceIds);

              return res;
            } catch (err) {
              console.warn(`Attempt ${attempt} to fetch invoice_items failed:`, err);
              if (attempt < attempts) {
                await new Promise(r => setTimeout(r, delayMs * attempt));
                continue;
              }
              throw err;
            }
          }
          return { data: [], error: null };
        }

        let invoiceItems = [] as any[];
        try {
          if (invoiceIds.length > 0) {
            const { data, error } = await queryInvoiceItemsWithRetry(3, 500);
            if (error) {
              console.error('Error fetching invoice items:', (error as any)?.message || error);
            } else if (data) {
              invoiceItems = data;
            }
          }
        } catch (err) {
          console.error('Network error fetching invoice items after retries:', err);
        }

        // Group items by invoice
        const itemsMap = new Map();
        (invoiceItems || []).forEach(item => {
          if (!itemsMap.has(item.invoice_id)) {
            itemsMap.set(item.invoice_id, []);
          }
          itemsMap.get(item.invoice_id).push(item);
        });

        // Fetch payment allocations for each invoice
        let paymentAllocations = [] as any[];
        try {
          if (invoiceIds.length > 0) {
            const { data, error } = await supabase
              .from('payment_allocations')
              .select(`
                id,
                invoice_id,
                payment_id,
                amount_allocated,
                payments(
                  id,
                  payment_number,
                  payment_date,
                  amount,
                  payment_method,
                  reference_number
                )
              `)
              .in('invoice_id', invoiceIds);

            if (error) {
              console.error('Error fetching payment allocations (non-fatal):', (error as any)?.message || error);
            } else if (data) {
              paymentAllocations = data;
            }
          }
        } catch (err) {
          console.error('Unexpected error fetching payment allocations (non-fatal):', err);
        }

        // Group payment allocations by invoice_id
        const allocationsMap = new Map();
        (paymentAllocations || []).forEach(alloc => {
          if (!allocationsMap.has(alloc.invoice_id)) {
            allocationsMap.set(alloc.invoice_id, []);
          }
          allocationsMap.get(alloc.invoice_id).push(alloc);
        });

        // Combine data with enriched information
        const enrichedInvoices = invoices.map(invoice => ({
          ...invoice,
          customers: customer || {
            name: 'Unknown Customer',
            email: null,
            phone: null
          },
          company: company || null,
          invoice_items: itemsMap.get(invoice.id) || [],
          payment_allocations: allocationsMap.get(invoice.id) || []
        }));

        return enrichedInvoices;

      } catch (error) {
        console.error('Error in useCustomerInvoicesFixed:', error);
        throw error;
      }
    },
    enabled: !!customerId,
    staleTime: 30000,
  });
};
