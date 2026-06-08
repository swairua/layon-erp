import { supabase } from '@/integrations/supabase/client';

const FUNCTIONS_SQL = `
-- Generate quotation number (shared counter with invoices, format: XXXXMMYYYY)
DROP FUNCTION IF EXISTS generate_quotation_number(UUID);
CREATE OR REPLACE FUNCTION generate_quotation_number(company_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    year_part VARCHAR(4);
    month_part VARCHAR(2);
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    month_part := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::VARCHAR, 2, '0');

    SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_number FROM '^[0-9]{4}') AS INTEGER)), 0) + 1
    INTO next_number
    FROM (
        SELECT quotation_number FROM quotations WHERE company_id = company_uuid
        UNION ALL
        SELECT invoice_number FROM invoices WHERE company_id = company_uuid
    ) AS all_docs;

    RETURN LPAD(next_number::VARCHAR, 4, '0') || month_part || year_part;
END;
$$ LANGUAGE plpgsql;

-- Generate invoice number (shared counter with quotations, format: INV-YYYY-XXX)
-- Counter resets each year
DROP FUNCTION IF EXISTS generate_invoice_number(UUID);
CREATE OR REPLACE FUNCTION generate_invoice_number(company_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    year_part VARCHAR(4);
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;

    -- Extract the numeric part from existing invoices and quotations from CURRENT YEAR ONLY
    -- For format "INV-YYYY-XXX", extract the XXX part where YYYY matches current year
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(invoice_number FROM 'INV-[0-9]{4}-([0-9]{3})') AS INTEGER)
    ), 0) + 1
    INTO next_number
    FROM (
        SELECT invoice_number FROM invoices
        WHERE company_id = company_uuid
        AND invoice_number LIKE 'INV-' || year_part || '-%'
        UNION ALL
        SELECT quotation_number FROM quotations
        WHERE company_id = company_uuid
        AND quotation_number LIKE 'INV-' || year_part || '-%'
    ) AS all_docs;

    RETURN 'INV-' || year_part || '-' || LPAD(next_number::VARCHAR, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Generate remittance number
DROP FUNCTION IF EXISTS generate_remittance_number(UUID);
CREATE OR REPLACE FUNCTION generate_remittance_number(company_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    year_part VARCHAR(4);
    month_part VARCHAR(2);
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    month_part := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::VARCHAR, 2, '0');

    SELECT COALESCE(MAX(CAST(SUBSTRING(remittance_number FROM '^[0-9]{4}') AS INTEGER)), 0) + 1
    INTO next_number
    FROM remittances
    WHERE company_id = company_uuid;

    RETURN LPAD(next_number::VARCHAR, 4, '0') || month_part || year_part;
END;
$$ LANGUAGE plpgsql;

-- Generate proforma number
DROP FUNCTION IF EXISTS generate_proforma_number(UUID);
CREATE OR REPLACE FUNCTION generate_proforma_number(company_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    year_part VARCHAR(4);
    month_part VARCHAR(2);
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    month_part := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::VARCHAR, 2, '0');

    SELECT COALESCE(MAX(CAST(SUBSTRING(proforma_number FROM '^[0-9]{4}') AS INTEGER)), 0) + 1
    INTO next_number
    FROM proformas
    WHERE company_id = company_uuid;

    RETURN LPAD(next_number::VARCHAR, 4, '0') || month_part || year_part;
END;
$$ LANGUAGE plpgsql;
`;

let functionsChecked = false;

export async function ensureDatabaseFunctionsExist() {
  // Only check once per session
  if (functionsChecked) return;

  try {
    // Try to call generate_quotation_number with a dummy UUID to check if it exists
    const dummyUUID = '00000000-0000-0000-0000-000000000000';
    const { error } = await supabase.rpc('generate_quotation_number', {
      company_uuid: dummyUUID
    });

    if (error?.code === 'PGRST202') {
      // Function doesn't exist
      console.log('⚠️ Database functions missing. Manual setup may be required.');
      console.log('Ensure the following functions are created in Supabase SQL Editor:');
      console.log('- generate_quotation_number(UUID)');
      console.log('- generate_invoice_number(UUID)');
      console.log('- generate_remittance_number(UUID)');
      console.log('- generate_proforma_number(UUID)');
    } else {
      console.log('✅ Database functions already exist');
    }
  } catch (error) {
    console.warn('⚠️ Error checking database functions:', error instanceof Error ? error.message : 'Unknown error');
  } finally {
    functionsChecked = true;
  }
}
