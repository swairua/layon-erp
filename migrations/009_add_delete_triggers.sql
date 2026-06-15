-- Migration: Add Delete Triggers for Automatic Audit Logging
-- This migration creates triggers on critical tables to automatically log deletions
-- at the database level, providing a safety net for audit compliance

BEGIN;

-- Function to automatically log deletions for critical tables
CREATE OR REPLACE FUNCTION log_delete_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_entity_type VARCHAR;
  v_entity_name VARCHAR;
  v_details JSONB;
  v_actor_email TEXT;
BEGIN
  v_entity_type := TG_TABLE_NAME;
  v_company_id := COALESCE(OLD.company_id, (SELECT company_id FROM companies LIMIT 1));

  BEGIN
    SELECT email INTO v_actor_email FROM auth.users WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_email := NULL;
  END;

  v_entity_name := CASE TG_TABLE_NAME
    WHEN 'customers' THEN OLD.name
    WHEN 'invoices' THEN OLD.invoice_number
    WHEN 'quotations' THEN OLD.quotation_number
    WHEN 'credit_notes' THEN OLD.credit_note_number
    WHEN 'proforma_invoices' THEN OLD.proforma_number
    WHEN 'lpos' THEN OLD.lpo_number
    WHEN 'boqs' THEN OLD.number
    WHEN 'tax_settings' THEN OLD.name
    ELSE NULL
  END;

  v_details := jsonb_build_object(
    'deletedAt', NOW(),
    'databaseTrigger', true,
    'entityName', v_entity_name,
    'deletedBy', COALESCE(
      (SELECT full_name FROM profiles WHERE id = auth.uid()),
      v_actor_email,
      'System'
    )
  );

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    INSERT INTO audit_logs (
      company_id,
      actor_user_id,
      actor_email,
      action,
      entity_type,
      record_id,
      details
    ) VALUES (
      v_company_id,
      auth.uid(),
      v_actor_email,
      'delete',
      v_entity_type,
      OLD.id,
      v_details
    );
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_delete_trigger() TO authenticated;

-- Create triggers only on tables that exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    DROP TRIGGER IF EXISTS customers_audit_delete ON customers;
    CREATE TRIGGER customers_audit_delete BEFORE DELETE ON customers FOR EACH ROW EXECUTE FUNCTION log_delete_trigger();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    DROP TRIGGER IF EXISTS invoices_audit_delete ON invoices;
    CREATE TRIGGER invoices_audit_delete BEFORE DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION log_delete_trigger();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotations') THEN
    DROP TRIGGER IF EXISTS quotations_audit_delete ON quotations;
    CREATE TRIGGER quotations_audit_delete BEFORE DELETE ON quotations FOR EACH ROW EXECUTE FUNCTION log_delete_trigger();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_notes') THEN
    DROP TRIGGER IF EXISTS credit_notes_audit_delete ON credit_notes;
    CREATE TRIGGER credit_notes_audit_delete BEFORE DELETE ON credit_notes FOR EACH ROW EXECUTE FUNCTION log_delete_trigger();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proforma_invoices') THEN
    DROP TRIGGER IF EXISTS proforma_invoices_audit_delete ON proforma_invoices;
    CREATE TRIGGER proforma_invoices_audit_delete BEFORE DELETE ON proforma_invoices FOR EACH ROW EXECUTE FUNCTION log_delete_trigger();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lpos') THEN
    DROP TRIGGER IF EXISTS lpos_audit_delete ON lpos;
    CREATE TRIGGER lpos_audit_delete BEFORE DELETE ON lpos FOR EACH ROW EXECUTE FUNCTION log_delete_trigger();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'boqs') THEN
    DROP TRIGGER IF EXISTS boqs_audit_delete ON boqs;
    CREATE TRIGGER boqs_audit_delete BEFORE DELETE ON boqs FOR EACH ROW EXECUTE FUNCTION log_delete_trigger();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tax_settings') THEN
    DROP TRIGGER IF EXISTS tax_settings_audit_delete ON tax_settings;
    CREATE TRIGGER tax_settings_audit_delete BEFORE DELETE ON tax_settings FOR EACH ROW EXECUTE FUNCTION log_delete_trigger();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_note_items') THEN
    DROP TRIGGER IF EXISTS credit_note_items_audit_delete ON credit_note_items;
    CREATE TRIGGER credit_note_items_audit_delete BEFORE DELETE ON credit_note_items FOR EACH ROW EXECUTE FUNCTION log_delete_trigger();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lpo_items') THEN
    DROP TRIGGER IF EXISTS lpo_items_audit_delete ON lpo_items;
    CREATE TRIGGER lpo_items_audit_delete BEFORE DELETE ON lpo_items FOR EACH ROW EXECUTE FUNCTION log_delete_trigger();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proforma_items') THEN
    DROP TRIGGER IF EXISTS proforma_items_audit_delete ON proforma_items;
    CREATE TRIGGER proforma_items_audit_delete BEFORE DELETE ON proforma_items FOR EACH ROW EXECUTE FUNCTION log_delete_trigger();
  END IF;
END $$;

COMMENT ON FUNCTION log_delete_trigger() IS 'Automatically logs all deletions to audit_logs table for compliance and recovery purposes.';

COMMIT;
