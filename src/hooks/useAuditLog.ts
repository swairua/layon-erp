import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AuditAction = 'delete' | 'create' | 'update' | 'restore';

export interface AuditLogEntry {
  action: AuditAction;
  entityType: string;
  recordId: string;
  details?: Record<string, any>;
}

export function useAuditLog() {
  const { profile } = useAuth();

  const logAction = useCallback(
    async (companyId: string, entry: AuditLogEntry) => {
      if (!profile?.id) {
        console.warn('Cannot log audit action without authenticated user');
        return null;
      }

      try {
        const payload = {
          company_id: companyId,
          actor_user_id: profile.id,
          actor_email: profile.email,
          action: entry.action,
          entity_type: entry.entityType,
          record_id: entry.recordId,
          details: entry.details || {},
        };

        const { data, error } = await supabase
          .from('audit_logs')
          .insert(payload)
          .select()
          .single();

        if (error) {
          console.error('Failed to log audit action:', error);
          return null;
        }

        return data;
      } catch (err) {
        console.error('Error logging audit action:', err);
        return null;
      }
    },
    [profile?.id, profile?.email]
  );

  const logDelete = useCallback(
    async (
      companyId: string,
      entityType: string,
      recordId: string,
      deletedData?: Record<string, any>
    ) => {
      return logAction(companyId, {
        action: 'delete',
        entityType,
        recordId,
        details: {
          deletedAt: new Date().toISOString(),
          deletedBy: profile?.full_name || profile?.email || 'Unknown',
          ...(deletedData ? { deletedData } : {}),
        },
      });
    },
    [logAction, profile?.email, profile?.full_name]
  );

  return {
    logAction,
    logDelete,
  };
}
