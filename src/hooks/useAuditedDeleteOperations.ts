import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { performAuditedDelete, performAuditedDeleteMultiple } from '@/utils/auditedDelete';

/**
 * Hook providing audited delete operations with automatic logging
 * Use these instead of direct delete mutations to ensure audit trails
 */
export function useAuditedDeleteOperations() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();

  const auditedDelete = useCallback(
    async (params: {
      tableName: string;
      whereKey: string;
      whereValue: string;
      entityType: string;
      entityId: string;
      entityName?: string;
      entityNumber?: string;
      deletedData?: Record<string, any>;
      companyId: string;
    }) => {
      if (!profile?.id) {
        throw new Error('User not authenticated');
      }

      return performAuditedDelete(
        params.tableName,
        params.whereKey,
        params.whereValue,
        {
          entityType: params.entityType,
          entityId: params.entityId,
          entityName: params.entityName,
          entityNumber: params.entityNumber,
          deletedData: params.deletedData,
        },
        {
          companyId: params.companyId,
          userId: profile.id,
          userFullName: profile.full_name,
          userEmail: profile.email,
        }
      );
    },
    [profile?.id, profile?.full_name, profile?.email]
  );

  // Customer delete
  const useDeleteCustomer = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        // This should be called from the page with companyId context
        throw new Error('Use useAuditedDeleteCustomer instead');
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      },
    });
  };

  // Audited customer delete
  const useAuditedDeleteCustomer = (companyId: string) => {
    return useMutation({
      mutationFn: async (id: string) => {
        // Fetch customer before deletion for audit
        const { data: customer } = await supabase
          .from('customers')
          .select('*')
          .eq('id', id)
          .eq('company_id', companyId)
          .single();

        // Perform audited delete
        const result = await auditedDelete({
          tableName: 'customers',
          whereKey: 'id',
          whereValue: id,
          entityType: 'Customer',
          entityId: id,
          entityName: customer?.name,
          deletedData: customer,
          companyId,
        });

        if (!result.success) {
          throw result.error || new Error('Failed to delete customer');
        }

        return result;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      },
    });
  };

  // Audited invoice delete
  const useAuditedDeleteInvoice = (companyId: string) => {
    return useMutation({
      mutationFn: async (id: string) => {
        // Fetch invoice before deletion for audit
        const { data: invoice } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', id)
          .eq('company_id', companyId)
          .single();

        // Perform audited delete
        const result = await auditedDelete({
          tableName: 'invoices',
          whereKey: 'id',
          whereValue: id,
          entityType: 'Invoice',
          entityId: id,
          entityName: invoice?.invoice_number,
          entityNumber: invoice?.invoice_number,
          deletedData: invoice,
          companyId,
        });

        if (!result.success) {
          throw result.error || new Error('Failed to delete invoice');
        }

        return result;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invoices_fixed'] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      },
    });
  };

  // Audited quotation delete
  const useAuditedDeleteQuotation = (companyId: string) => {
    return useMutation({
      mutationFn: async (id: string) => {
        // Fetch quotation before deletion for audit
        const { data: quotation } = await supabase
          .from('quotations')
          .select('*')
          .eq('id', id)
          .eq('company_id', companyId)
          .single();

        // Perform audited delete
        const result = await auditedDelete({
          tableName: 'quotations',
          whereKey: 'id',
          whereValue: id,
          entityType: 'Quotation',
          entityId: id,
          entityName: quotation?.quotation_number,
          entityNumber: quotation?.quotation_number,
          deletedData: quotation,
          companyId,
        });

        if (!result.success) {
          throw result.error || new Error('Failed to delete quotation');
        }

        return result;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
      },
    });
  };

  // Audited credit note delete
  const useAuditedDeleteCreditNote = (companyId: string) => {
    return useMutation({
      mutationFn: async (id: string) => {
        // Fetch credit note before deletion for audit
        const { data: creditNote } = await supabase
          .from('credit_notes')
          .select('*')
          .eq('id', id)
          .eq('company_id', companyId)
          .single();

        // Perform audited delete
        const result = await auditedDelete({
          tableName: 'credit_notes',
          whereKey: 'id',
          whereValue: id,
          entityType: 'CreditNote',
          entityId: id,
          entityName: creditNote?.credit_note_number,
          entityNumber: creditNote?.credit_note_number,
          deletedData: creditNote,
          companyId,
        });

        if (!result.success) {
          throw result.error || new Error('Failed to delete credit note');
        }

        return result;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
      },
    });
  };

  // Audited proforma delete
  const useAuditedDeleteProforma = (companyId: string) => {
    return useMutation({
      mutationFn: async (id: string) => {
        // Fetch proforma before deletion for audit
        const { data: proforma } = await supabase
          .from('proforma_invoices')
          .select('*')
          .eq('id', id)
          .eq('company_id', companyId)
          .single();

        // Perform audited delete
        const result = await auditedDelete({
          tableName: 'proforma_invoices',
          whereKey: 'id',
          whereValue: id,
          entityType: 'ProformaInvoice',
          entityId: id,
          entityName: proforma?.proforma_number,
          entityNumber: proforma?.proforma_number,
          deletedData: proforma,
          companyId,
        });

        if (!result.success) {
          throw result.error || new Error('Failed to delete proforma invoice');
        }

        return result;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['proforma_invoices'] });
      },
    });
  };

  // Audited LPO delete
  const useAuditedDeleteLPO = (companyId: string) => {
    return useMutation({
      mutationFn: async (id: string) => {
        // Fetch LPO before deletion for audit
        const { data: lpo } = await supabase
          .from('lpos')
          .select('*')
          .eq('id', id)
          .eq('company_id', companyId)
          .single();

        // Perform audited delete
        const result = await auditedDelete({
          tableName: 'lpos',
          whereKey: 'id',
          whereValue: id,
          entityType: 'LPO',
          entityId: id,
          entityName: lpo?.lpo_number,
          entityNumber: lpo?.lpo_number,
          deletedData: lpo,
          companyId,
        });

        if (!result.success) {
          throw result.error || new Error('Failed to delete LPO');
        }

        return result;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['lpos'] });
      },
    });
  };

  // Audited BOQ delete
  const useAuditedDeleteBOQ = (companyId: string) => {
    return useMutation({
      mutationFn: async (id: string) => {
        // Fetch BOQ before deletion for audit
        const { data: boq, error: fetchError } = await supabase
          .from('boqs')
          .select('*')
          .eq('id', id)
          .eq('company_id', companyId)
          .single();

        if (fetchError) {
          console.error('Error fetching BOQ for deletion:', fetchError);
          throw new Error(`Could not verify BOQ status: ${fetchError.message}`);
        }

        if (!boq) {
          throw new Error('BOQ not found');
        }

        if (boq.converted_to_invoice_id) {
          throw new Error(`Cannot delete BOQ ${boq.number}: It has been converted to an invoice. Please delete the invoice first if you really need to delete this BOQ.`);
        }

        // Perform audited delete
        const result = await auditedDelete({
          tableName: 'boqs',
          whereKey: 'id',
          whereValue: id,
          entityType: 'BOQ',
          entityId: id,
          entityName: boq.number,
          deletedData: boq,
          companyId,
        });

        if (!result.success) {
          // If it's a foreign key error, provide a better message
          const errorMsg = result.error?.message || '';
          if (errorMsg.includes('foreign key') || errorMsg.includes('violates foreign key constraint')) {
            throw new Error(`Cannot delete BOQ ${boq.number}: It is referenced by other records (e.g. invoices). Please remove those references first.`);
          }
          throw result.error || new Error('Failed to delete BOQ');
        }

        return result;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['boqs'] });
      },
    });
  };

  // Audited Fixed BOQ item delete
  const useAuditedDeleteFixedBOQItem = (companyId: string) => {
    return useMutation({
      mutationFn: async (id: string) => {
        // Fetch item before deletion for audit
        const { data: item } = await supabase
          .from('fixed_boq_items')
          .select('*')
          .eq('id', id)
          .single();

        // Perform audited delete
        const result = await auditedDelete({
          tableName: 'fixed_boq_items',
          whereKey: 'id',
          whereValue: id,
          entityType: 'FixedBOQItem',
          entityId: id,
          entityName: item?.description,
          deletedData: item,
          companyId,
        });

        if (!result.success) {
          throw result.error || new Error('Failed to delete Fixed BOQ item');
        }

        return result;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['fixed_boq_items'] });
      },
    });
  };

  // Audited tax setting delete
  const useAuditedDeleteTaxSetting = (companyId: string) => {
    return useMutation({
      mutationFn: async (id: string) => {
        // Fetch tax setting before deletion for audit
        const { data: taxSetting } = await supabase
          .from('tax_settings')
          .select('*')
          .eq('id', id)
          .single();

        // Perform audited delete
        const result = await auditedDelete({
          tableName: 'tax_settings',
          whereKey: 'id',
          whereValue: id,
          entityType: 'TaxSetting',
          entityId: id,
          entityName: taxSetting?.name,
          deletedData: taxSetting,
          companyId,
        });

        if (!result.success) {
          throw result.error || new Error('Failed to delete tax setting');
        }

        return result;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['tax_settings'] });
      },
    });
  };

  // Audited unit delete
  const useAuditedDeleteUnit = (companyId: string) => {
    return useMutation({
      mutationFn: async (id: string) => {
        // Fetch unit before deletion for audit
        const { data: unit } = await supabase
          .from('units')
          .select('*')
          .eq('id', id)
          .single();

        // Perform audited delete
        const result = await auditedDelete({
          tableName: 'units',
          whereKey: 'id',
          whereValue: id,
          entityType: 'Unit',
          entityId: id,
          entityName: unit?.name,
          deletedData: unit,
          companyId,
        });

        if (!result.success) {
          throw result.error || new Error('Failed to delete unit');
        }

        return result;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['units'] });
      },
    });
  };

  // Audited LPO item delete
  const useAuditedDeleteLPOItem = (companyId: string) => {
    return useMutation({
      mutationFn: async (id: string) => {
        // Fetch LPO item before deletion for audit
        const { data: lpoItem } = await supabase
          .from('lpo_items')
          .select('*')
          .eq('id', id)
          .single();

        // Perform audited delete
        const result = await auditedDelete({
          tableName: 'lpo_items',
          whereKey: 'id',
          whereValue: id,
          entityType: 'LPOItem',
          entityId: id,
          deletedData: lpoItem,
          companyId,
        });

        if (!result.success) {
          throw result.error || new Error('Failed to delete LPO item');
        }

        return result;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['lpos'] });
      },
    });
  };

  // Audited credit note item delete
  const useAuditedDeleteCreditNoteItem = (companyId: string) => {
    return useMutation({
      mutationFn: async (id: string) => {
        // Fetch credit note item before deletion for audit
        const { data: creditNoteItem } = await supabase
          .from('credit_note_items')
          .select('*')
          .eq('id', id)
          .single();

        // Perform audited delete
        const result = await auditedDelete({
          tableName: 'credit_note_items',
          whereKey: 'id',
          whereValue: id,
          entityType: 'CreditNoteItem',
          entityId: id,
          deletedData: creditNoteItem,
          companyId,
        });

        if (!result.success) {
          throw result.error || new Error('Failed to delete credit note item');
        }

        return result;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
      },
    });
  };

  // Audited delete multiple items by parent ID
  const useAuditedDeleteByParent = (companyId: string) => {
    return useMutation({
      mutationFn: async (params: {
        tableName: string;
        parentKey: string;
        parentValue: string;
        entityType: string;
        entityIds: string[];
      }) => {
        if (!profile?.id) {
          throw new Error('User not authenticated');
        }

        const result = await performAuditedDeleteMultiple(
          params.tableName,
          params.parentKey,
          params.parentValue,
          {
            entityType: params.entityType,
            entityIds: params.entityIds,
          },
          {
            companyId,
            userId: profile.id,
            userFullName: profile.full_name,
            userEmail: profile.email,
          }
        );

        if (!result.success) {
          throw result.error || new Error('Failed to delete items');
        }

        return result;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['all'] });
      },
    });
  };

  return {
    auditedDelete,
    useAuditedDeleteCustomer,
    useAuditedDeleteInvoice,
    useAuditedDeleteQuotation,
    useAuditedDeleteCreditNote,
    useAuditedDeleteProforma,
    useAuditedDeleteLPO,
    useAuditedDeleteBOQ,
    useAuditedDeleteTaxSetting,
    useAuditedDeleteUnit,
    useAuditedDeleteLPOItem,
    useAuditedDeleteCreditNoteItem,
    useAuditedDeleteFixedBOQItem,
    useAuditedDeleteByParent,
  };
}
