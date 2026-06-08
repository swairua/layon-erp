import { supabase } from '@/integrations/supabase/client';

/**
 * Check if a database function exists
 * NOTE: information_schema.routines is not exposed via Supabase REST API
 * This now attempts to call the function directly instead
 */
export async function checkDatabaseFunction(functionName: string): Promise<{
  exists: boolean;
  error?: string;
}> {
  try {
    // Try calling the function with dummy params to check if it exists
    const { error } = await supabase.rpc(functionName, { company_uuid: '00000000-0000-0000-0000-000000000000' });

    // If we get a "function does not exist" error, the function is missing
    // Any other error means the function exists but failed on params
    if (error?.code === 'PGRST202' || error?.message?.includes('does not exist')) {
      return { exists: false, error: error?.message };
    }

    // Function exists (either succeeded or failed for other reasons)
    return { exists: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // If we can't reach RPC, assume function doesn't exist
    return { exists: false, error: errorMessage };
  }
}

/**
 * Check if proforma number generation function exists
 */
export async function checkProformaNumberFunction(): Promise<{
  exists: boolean;
  error?: string;
  canGenerate: boolean;
}> {
  const functionCheck = await checkDatabaseFunction('generate_proforma_number');
  
  if (!functionCheck.exists) {
    return {
      exists: false,
      error: functionCheck.error || 'Function not found',
      canGenerate: false
    };
  }

  // Test if function can actually be called with a test UUID
  try {
    const testCompanyId = '00000000-0000-0000-0000-000000000000';
    const { error: testError } = await supabase.rpc('generate_proforma_number', {
      company_uuid: testCompanyId
    });

    // If there's no error or it's just a "no records found" type error, function works
    const canGenerate = !testError || 
      testError.message?.includes('no rows') || 
      testError.message?.includes('not found');

    return {
      exists: true,
      canGenerate,
      error: testError && !canGenerate ? testError.message : undefined
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      exists: true,
      canGenerate: false,
      error: errorMessage
    };
  }
}

/**
 * Create the generate_proforma_number function if it doesn't exist
 */
export async function createProformaNumberFunction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const functionSQL = `
      CREATE OR REPLACE FUNCTION generate_proforma_number(company_uuid UUID)
      RETURNS TEXT AS $$
      DECLARE
          next_number INTEGER;
          year_part TEXT;
      BEGIN
          year_part := EXTRACT(year FROM CURRENT_DATE)::TEXT;

          -- Get the next number for this month/year and company (format: YYYYMMDD)
          SELECT COALESCE(MAX(
              CASE
                  WHEN proforma_number ~ ('^[0-9]{4}' || LPAD(EXTRACT(month FROM CURRENT_DATE)::TEXT, 2, '0') || year_part || '$')
                  THEN CAST(SUBSTRING(proforma_number FROM 1 FOR 4) AS INTEGER)
                  ELSE 0
              END
          ), 0) + 1
          INTO next_number
          FROM proforma_invoices
          WHERE company_id = company_uuid
          AND proforma_number LIKE '%' || LPAD(EXTRACT(month FROM CURRENT_DATE)::TEXT, 2, '0') || year_part;

          -- Format as YYYYMMDD (e.g., 0001102024)
          RETURN LPAD(next_number::TEXT, 4, '0') || LPAD(EXTRACT(month FROM CURRENT_DATE)::TEXT, 2, '0') || year_part;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql: functionSQL });

    if (error) {
      console.error('Error creating proforma number function:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating proforma number function:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get a formatted error message from a Supabase error
 */
export function getSupabaseErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return error.message;
  if (error.details) return error.details;
  if (error.hint) return error.hint;
  if (error.code) return `Error code: ${error.code}`;
  
  // Try to extract meaningful info from the error object
  try {
    const errorStr = JSON.stringify(error);
    if (errorStr !== '{}') return errorStr;
  } catch {
    // JSON.stringify failed, fallback to string conversion
  }
  
  return String(error);
}
