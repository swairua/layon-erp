import { supabase } from '@/integrations/supabase/client';
import { parseErrorMessage } from './errorHelpers';

/**
 * Verify the setup after manual SQL execution
 */
export async function verifyManualSetup() {
  console.log('🔍 Verifying manual setup completion...');
  
  const results = {
    databaseStatus: {
      quotationTaxColumns: false,
      invoiceTaxColumns: false,
      lpoTables: false,
      rpcFunctions: false
    },
    authStatus: {
      connectionWorking: false,
      adminUserExists: false,
      canCreateUsers: false
    },
    issues: [] as string[],
    successes: [] as string[],
    nextSteps: [] as string[]
  };

  // Check 1: Quotation tax columns
  try {
    const { data, error } = await supabase
      .from('quotation_items')
      .select('id, tax_amount, tax_percentage, tax_inclusive')
      .limit(1);

    if (!error) {
      results.databaseStatus.quotationTaxColumns = true;
      results.successes.push('✅ Quotation tax columns are working');
      console.log('✅ Quotation tax columns verified');
    } else if (error.message.includes('tax_amount')) {
      results.issues.push('❌ Quotation tax columns still missing');
      console.log('❌ Quotation tax columns still missing');
    }
  } catch (error) {
    results.issues.push('❌ Error checking quotation tax columns');
  }

  // Check 2: Invoice tax columns
  try {
    const { data, error } = await supabase
      .from('invoice_items')
      .select('id, tax_amount, tax_percentage, tax_inclusive')
      .limit(1);

    if (!error) {
      results.databaseStatus.invoiceTaxColumns = true;
      results.successes.push('✅ Invoice tax columns are working');
      console.log('✅ Invoice tax columns verified');
    } else if (error.message.includes('tax_amount')) {
      results.issues.push('❌ Invoice tax columns still missing');
      console.log('❌ Invoice tax columns still missing');
    }
  } catch (error) {
    results.issues.push('❌ Error checking invoice tax columns');
  }

  // Check 3: LPO tables
  try {
    const { data, error } = await supabase
      .from('lpos')
      .select('id, lpo_number, status')
      .limit(1);

    if (!error) {
      results.databaseStatus.lpoTables = true;
      results.successes.push('✅ LPO tables are working');
      console.log('✅ LPO tables verified');
    } else {
      results.issues.push('❌ LPO tables not found');
      console.log('❌ LPO tables not found');
    }
  } catch (error) {
    results.issues.push('❌ Error checking LPO tables');
  }

  // Check 4: RPC functions
  try {
    const { error } = await supabase
      .rpc('generate_lpo_number', { company_uuid: '00000000-0000-0000-0000-000000000000' });

    if (!error || !error.message.includes('does not exist')) {
      results.databaseStatus.rpcFunctions = true;
      results.successes.push('✅ RPC functions are working');
      console.log('✅ RPC functions verified');
    } else {
      results.issues.push('❌ RPC functions missing');
      console.log('❌ RPC functions missing');
    }
  } catch (error) {
    results.issues.push('❌ Error checking RPC functions');
  }

  // Check 5: Auth system
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (!error) {
      results.authStatus.connectionWorking = true;
      results.successes.push('✅ Authentication system working');
      console.log('✅ Auth system verified');
    }
  } catch (error) {
    results.issues.push('❌ Auth system not working');
  }

  // Check 6: Admin user exists
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('role', 'admin')
      .limit(1);

    if (!error && profiles && profiles.length > 0) {
      results.authStatus.adminUserExists = true;
      results.successes.push('✅ Super admin user exists');
      console.log('✅ Super admin user found');
    } else {
      results.issues.push('❌ No super admin user found');
      results.nextSteps.push('Create super admin user');
      console.log('❌ No super admin user found');
    }
  } catch (error) {
    results.issues.push('❌ Error checking admin user');
  }

  // Determine next steps
  if (results.issues.length === 0) {
    results.nextSteps.push('🎉 Setup is complete! You can start using the system.');
  } else {
    if (!results.databaseStatus.quotationTaxColumns || !results.databaseStatus.invoiceTaxColumns) {
      results.nextSteps.push('Execute the tax columns SQL script');
    }
    if (!results.databaseStatus.lpoTables) {
      results.nextSteps.push('Execute the LPO tables SQL script');
    }
    if (!results.authStatus.adminUserExists) {
      results.nextSteps.push('Create super admin user account');
    }
  }

  const databaseWorking = results.databaseStatus.quotationTaxColumns && results.databaseStatus.invoiceTaxColumns;
  const systemReady = databaseWorking && results.authStatus.adminUserExists;

  console.log(`📊 Manual Setup Verification Complete:`);
  console.log(`   Database: ${databaseWorking ? 'Working' : 'Needs fixes'}`);
  console.log(`   Auth: ${results.authStatus.adminUserExists ? 'Ready' : 'Needs admin'}`);
  console.log(`   Overall: ${systemReady ? 'Ready to use' : 'Needs completion'}`);

  return {
    ...results,
    databaseWorking,
    systemReady,
    summary: `${results.successes.length} working, ${results.issues.length} issues`
  };
}

/**
 * Test core functionality after manual setup
 */
export async function testCoreSystemAfterSetup() {
  console.log('🧪 Testing core system functionality...');
  
  const tests = {
    quotationCreation: false,
    inventoryAccess: false,
    customerAccess: false,
    errors: [] as string[]
  };

  // Test quotation system
  try {
    const { data, error } = await supabase
      .from('quotations')
      .select('id, quotation_number')
      .limit(1);
    
    if (!error) {
      tests.quotationCreation = true;
      console.log('✅ Quotation system accessible');
    } else {
      tests.errors.push(`Quotation access: ${error.message}`);
    }
  } catch (error) {
    tests.errors.push(`Quotation test failed: ${parseErrorMessage(error)}`);
  }

  // Test inventory system
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name')
      .limit(1);
    
    if (!error) {
      tests.inventoryAccess = true;
      console.log('✅ Inventory system accessible');
    } else {
      tests.errors.push(`Inventory access: ${error.message}`);
    }
  } catch (error) {
    tests.errors.push(`Inventory test failed: ${parseErrorMessage(error)}`);
  }

  // Test customer system
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name')
      .limit(1);
    
    if (!error) {
      tests.customerAccess = true;
      console.log('✅ Customer system accessible');
    } else {
      tests.errors.push(`Customer access: ${error.message}`);
    }
  } catch (error) {
    tests.errors.push(`Customer test failed: ${parseErrorMessage(error)}`);
  }

  const workingCount = [tests.quotationCreation, tests.inventoryAccess, tests.customerAccess].filter(Boolean).length;
  
  return {
    ...tests,
    workingCount,
    totalTests: 3,
    allWorking: workingCount === 3,
    summary: `${workingCount}/3 systems working`
  };
}
