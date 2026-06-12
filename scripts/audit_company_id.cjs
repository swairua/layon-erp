const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditCompanyId() {
  console.log('=== COMPANY ID AUDIT ===\n');

  try {
    // Step 1: Get all companies
    console.log('STEP 1: Finding all companies...');
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: true });

    if (companiesError) throw companiesError;

    console.log(`Found ${companies.length} company(ies):\n`);
    
    if (companies.length === 0) {
      console.error('ERROR: No companies found in database!');
      process.exit(1);
    }

    for (const company of companies) {
      console.log(`  ID: ${company.id}`);
      console.log(`  Name: ${company.name}`);
      console.log(`  Created: ${company.created_at}\n`);
    }

    const canonicalCompanyId = companies[0].id;
    console.log(`\n✓ Canonical Company ID: ${canonicalCompanyId}\n`);

    // Step 2: Audit each table
    const tablesToAudit = [
      { name: 'profiles', hasCompanyId: true },
      { name: 'customers', hasCompanyId: true },
      { name: 'products', hasCompanyId: true },
      { name: 'product_categories', hasCompanyId: true },
      { name: 'quotations', hasCompanyId: true },
      { name: 'invoices', hasCompanyId: true },
      { name: 'boqs', hasCompanyId: true },
      { name: 'lcl_boqs', hasCompanyId: true },
    ];

    console.log('\n=== AUDITING TABLES ===\n');

    for (const table of tablesToAudit) {
      if (!table.hasCompanyId) continue;

      const { data, error, count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact' });

      if (error) {
        console.log(`⚠ ${table.name}: Error reading table -`, error.message);
        continue;
      }

      const totalRecords = count || data.length;
      const nullCount = data.filter(r => r.company_id === null).length;
      const invalidCount = data.filter(
        r => r.company_id !== null && !companies.some(c => c.id === r.company_id)
      ).length;
      const validCount = totalRecords - nullCount - invalidCount;

      console.log(`${table.name}:`);
      console.log(`  Total: ${totalRecords}`);
      console.log(`  Valid company_id: ${validCount}`);
      console.log(`  NULL company_id: ${nullCount}`);
      console.log(`  Invalid company_id: ${invalidCount}`);

      if (nullCount > 0 || invalidCount > 0) {
        console.log(`  ⚠ ACTION NEEDED: Found ${nullCount + invalidCount} inconsistent record(s)`);
      } else {
        console.log(`  ✓ All records have valid company_id`);
      }
      console.log('');
    }

    console.log('\n=== SUMMARY ===');
    console.log(`System is single-tenant with canonical company_id: ${canonicalCompanyId}`);
    console.log(`All multi-tenant tables should have their records pointing to this ID.`);

  } catch (error) {
    console.error('Audit failed:', error.message);
    process.exit(1);
  }
}

auditCompanyId();
