import { supabase } from '@/integrations/supabase/client';

/**
 * Fixes the Sales user (sales@layonsconstruction.com) missing company_id issue
 * Updates their company_id from null to match the System Administrator's company
 */
export const fixSalesUserCompanyId = async () => {
  try {
    // First, fetch the System Administrator's company_id
    const { data: adminUser, error: adminError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('email', 'info@construction.com')
      .single();

    if (adminError) {
      throw new Error(`Failed to fetch System Administrator: ${adminError.message}`);
    }

    if (!adminUser?.company_id) {
      throw new Error('System Administrator has no company_id assigned');
    }

    const targetCompanyId = adminUser.company_id;

    // Update the Sales user's company_id
    const { data: updateResult, error: updateError } = await supabase
      .from('profiles')
      .update({ company_id: targetCompanyId })
      .eq('email', 'sales@layonsconstruction.com')
      .select();

    if (updateError) {
      throw new Error(`Failed to update Sales user: ${updateError.message}`);
    }

    if (!updateResult || updateResult.length === 0) {
      throw new Error('Sales user not found or update returned no results');
    }

    return {
      success: true,
      message: `Successfully updated Sales user company_id to ${targetCompanyId}`,
      updatedUser: updateResult[0],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      message: `Failed to fix Sales user company_id: ${errorMessage}`,
      error: errorMessage,
    };
  }
};
