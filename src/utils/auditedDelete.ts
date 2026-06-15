import { supabase } from '@/integrations/supabase/client';
import { parseErrorMessage } from './errorHelpers';

export interface AuditedDeleteOptions {
  companyId: string;
  userId: string;
  userFullName?: string;
  userEmail?: string;
}

export interface DeleteTarget {
  entityType: string;
  entityId: string;
  deletedData?: Record<string, any>;
}

export async function performAuditedDelete(
  tableName: string,
  whereKey: string,
  whereValue: string,
  target: DeleteTarget,
  options: AuditedDeleteOptions
): Promise<{ success: boolean; error?: Error }> {
  try {
    const { data: recordToDelete, error: fetchError } = await supabase
      .from(tableName)
      .select('*')
      .eq(whereKey, whereValue)
      .single();

    if (fetchError) {
      console.warn(`Warning: Could not fetch ${tableName} record for audit:`, fetchError);
    }

    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq(whereKey, whereValue);

    if (deleteError) {
      const errorMessage = parseErrorMessage(deleteError);
      console.error(`Delete failed for ${tableName}:`, deleteError, `- Message: ${errorMessage}`);
      return { success: false, error: new Error(errorMessage) };
    }

    const auditPayload = {
      company_id: options.companyId,
      actor_user_id: options.userId,
      actor_email: options.userEmail || null,
      action: 'delete',
      entity_type: target.entityType,
      record_id: target.entityId,
      details: {
        deletedAt: new Date().toISOString(),
        deletedBy: options.userFullName || options.userEmail || 'Unknown',
        tableName,
        whereKey,
        whereValue,
        ...(target.deletedData || recordToDelete ? { deletedData: target.deletedData || recordToDelete } : {}),
      },
    };

    try {
      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert([auditPayload]);

      if (auditError) {
        console.error('Failed to log deletion to audit_logs:', auditError);
      }
    } catch (auditErr) {
      console.warn('Unexpected error while logging audit deletion:', auditErr);
    }

    return { success: true };
  } catch (err) {
    const errorMessage = parseErrorMessage(err);
    const error = new Error(errorMessage);
    console.error('Error in performAuditedDelete:', err, `- Message: ${errorMessage}`);
    return { success: false, error };
  }
}

export async function performAuditedDeleteMultiple(
  tableName: string,
  whereKey: string,
  whereValue: string,
  target: Omit<DeleteTarget, 'entityId'> & { entityIds: string[] },
  options: AuditedDeleteOptions
): Promise<{ success: boolean; deletedCount?: number; error?: Error }> {
  try {
    const { data: recordsToDelete, error: fetchError } = await supabase
      .from(tableName)
      .select('*')
      .eq(whereKey, whereValue);

    if (fetchError) {
      console.warn(`Warning: Could not fetch ${tableName} records for audit:`, fetchError);
    }

    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq(whereKey, whereValue);

    if (deleteError) {
      const errorMessage = parseErrorMessage(deleteError);
      console.error(`Delete failed for ${tableName}:`, deleteError, `- Message: ${errorMessage}`);
      return { success: false, error: new Error(errorMessage) };
    }

    const auditEntries = target.entityIds.map((entityId) => ({
      company_id: options.companyId,
      actor_user_id: options.userId,
      actor_email: options.userEmail || null,
      action: 'delete',
      entity_type: target.entityType,
      record_id: entityId,
      details: {
        deletedAt: new Date().toISOString(),
        deletedBy: options.userFullName || options.userEmail || 'Unknown',
        tableName,
        whereKey,
        whereValue,
        cascadeDelete: true,
      },
    }));

    if (auditEntries.length > 0) {
      try {
        const { error: auditError } = await supabase
          .from('audit_logs')
          .insert(auditEntries);

        if (auditError) {
          console.warn('Failed to log deletions to audit_logs:', auditError);
        }
      } catch (auditErr) {
        console.warn('Unexpected error while logging audit deletions:', auditErr);
      }
    }

    return { success: true, deletedCount: recordsToDelete?.length || 0 };
  } catch (err) {
    const errorMessage = parseErrorMessage(err);
    const error = new Error(errorMessage);
    console.error('Error in performAuditedDeleteMultiple:', err, `- Message: ${errorMessage}`);
    return { success: false, error };
  }
}
