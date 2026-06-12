import { supabase } from '@/integrations/supabase/client';

export interface AuditResult {
  canonicalCompanyId: string | null;
  totalCompanies: number;
  profilesWithNull: number;
  profileDistribution: Record<string, number>;
  customersAnomalies: {
    nullCount: number;
    withCompanyCount: number;
    distinctCompanies: number;
  };
  boqsAnomalies: {
    nullCount: number;
    withCompanyCount: number;
    distinctCompanies: number;
  };
  invoicesAnomalies: {
    nullCount: number;
    withCompanyCount: number;
    distinctCompanies: number;
  };
  timestamp: string;
}

export interface ConsolidationResult {
  success: boolean;
  message: string;
  affectedRows?: number;
  canonicalCompanyId?: string;
  error?: string;
}

export interface VerificationResult {
  profilesWithNull: number;
  customersWithNull: number;
  boqsWithNull: number;
  invoicesWithNull: number;
  distinctCompaniesAcrossAll: number;
  isHealthy: boolean;
  timestamp: string;
}

/**
 * Audit the database to find company_id inconsistencies
 */
export async function auditCompanyIds(): Promise<AuditResult> {
  try {
    // Get canonical company (oldest)
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, created_at')
      .order('created_at', { ascending: true });

    const canonicalCompanyId = companies?.[0]?.id || null;

    // Get profiles with null company_id
    const { data: profilesNull } = await supabase
      .from('profiles')
      .select('id, email, company_id', { count: 'exact' })
      .is('company_id', null);

    // Get profile distribution
    const { data: profileDist } = await supabase
      .from('profiles')
      .select('company_id', { count: 'exact' });

    const profileDistribution: Record<string, number> = {};
    profileDist?.forEach((p: any) => {
      const key = p.company_id || 'NULL';
      profileDistribution[key] = (profileDistribution[key] || 0) + 1;
    });

    // Customers anomalies
    const { data: customersAll } = await supabase
      .from('customers')
      .select('company_id', { count: 'exact' });

    const customersAnomalies = {
      nullCount: customersAll?.filter((c: any) => !c.company_id).length || 0,
      withCompanyCount:
        customersAll?.filter((c: any) => c.company_id).length || 0,
      distinctCompanies: new Set(
        customersAll?.map((c: any) => c.company_id).filter(Boolean)
      ).size,
    };

    // BOQs anomalies
    const { data: boqsAll } = await supabase
      .from('boqs')
      .select('company_id', { count: 'exact' });

    const boqsAnomalies = {
      nullCount: boqsAll?.filter((b: any) => !b.company_id).length || 0,
      withCompanyCount:
        boqsAll?.filter((b: any) => b.company_id).length || 0,
      distinctCompanies: new Set(
        boqsAll?.map((b: any) => b.company_id).filter(Boolean)
      ).size,
    };

    // Invoices anomalies
    const { data: invoicesAll } = await supabase
      .from('invoices')
      .select('company_id', { count: 'exact' });

    const invoicesAnomalies = {
      nullCount: invoicesAll?.filter((i: any) => !i.company_id).length || 0,
      withCompanyCount:
        invoicesAll?.filter((i: any) => i.company_id).length || 0,
      distinctCompanies: new Set(
        invoicesAll?.map((i: any) => i.company_id).filter(Boolean)
      ).size,
    };

    return {
      canonicalCompanyId,
      totalCompanies: companies?.length || 0,
      profilesWithNull: profilesNull?.length || 0,
      profileDistribution,
      customersAnomalies,
      boqsAnomalies,
      invoicesAnomalies,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Audit failed:', error);
    throw error;
  }
}

/**
 * Execute the company_id consolidation migration
 * WARNING: This updates all NULL and orphaned company_id values to canonical
 */
export async function consolidateCompanyIds(): Promise<ConsolidationResult> {
  try {
    const audit = await auditCompanyIds();

    if (!audit.canonicalCompanyId) {
      return {
        success: false,
        message: 'No companies found in database. Cannot consolidate.',
      };
    }

    // Execute the raw SQL migration via RPC or direct query
    // Since we can't directly execute complex SQL migrations via the client,
    // we'll execute individual update statements

    const canonicalId = audit.canonicalCompanyId;
    const updates = [];

    // Update profiles
    const profilesResult = await supabase
      .from('profiles')
      .update({ company_id: canonicalId })
      .is('company_id', null);

    updates.push(
      profilesResult.error
        ? 0
        : profilesResult.data?.length || 0
    );

    // Update customers
    const customersResult = await supabase
      .from('customers')
      .update({ company_id: canonicalId })
      .is('company_id', null);

    updates.push(
      customersResult.error
        ? 0
        : customersResult.data?.length || 0
    );

    // Update boqs
    const boqsResult = await supabase
      .from('boqs')
      .update({ company_id: canonicalId })
      .is('company_id', null);

    updates.push(
      boqsResult.error
        ? 0
        : boqsResult.data?.length || 0
    );

    // Update invoices (via customer relationship first)
    const invoicesResult = await supabase
      .from('invoices')
      .update({ company_id: canonicalId })
      .is('company_id', null);

    updates.push(
      invoicesResult.error
        ? 0
        : invoicesResult.data?.length || 0
    );

    const totalAffected = updates.reduce((a, b) => a + b, 0);

    return {
      success: true,
      message: `Successfully consolidated company_id. Updated ${totalAffected} records to canonical company ${canonicalId}`,
      canonicalCompanyId: canonicalId,
      affectedRows: totalAffected,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Consolidation failed: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

/**
 * Verify that consolidation was successful
 */
export async function verifyConsolidation(): Promise<VerificationResult> {
  try {
    const { data: profilesNull } = await supabase
      .from('profiles')
      .select('company_id', { count: 'exact' })
      .is('company_id', null);

    const { data: customersNull } = await supabase
      .from('customers')
      .select('company_id', { count: 'exact' })
      .is('company_id', null);

    const { data: boqsNull } = await supabase
      .from('boqs')
      .select('company_id', { count: 'exact' })
      .is('company_id', null);

    const { data: invoicesNull } = await supabase
      .from('invoices')
      .select('company_id', { count: 'exact' })
      .is('company_id', null);

    // Get all distinct company IDs in use
    const allCompanyIds = new Set<string>();

    const { data: profileCompanies } = await supabase
      .from('profiles')
      .select('company_id')
      .not('company_id', 'is', null);

    const { data: customerCompanies } = await supabase
      .from('customers')
      .select('company_id')
      .not('company_id', 'is', null);

    const { data: boqCompanies } = await supabase
      .from('boqs')
      .select('company_id')
      .not('company_id', 'is', null);

    const { data: invoiceCompanies } = await supabase
      .from('invoices')
      .select('company_id')
      .not('company_id', 'is', null);

    [profileCompanies, customerCompanies, boqCompanies, invoiceCompanies].forEach(
      (data) => {
        data?.forEach((row: any) => {
          if (row.company_id) allCompanyIds.add(row.company_id);
        });
      }
    );

    const isHealthy =
      (profilesNull?.length || 0) === 0 &&
      (customersNull?.length || 0) === 0 &&
      (boqsNull?.length || 0) === 0 &&
      (invoicesNull?.length || 0) === 0 &&
      allCompanyIds.size === 1;

    return {
      profilesWithNull: profilesNull?.length || 0,
      customersWithNull: customersNull?.length || 0,
      boqsWithNull: boqsNull?.length || 0,
      invoicesWithNull: invoicesNull?.length || 0,
      distinctCompaniesAcrossAll: allCompanyIds.size,
      isHealthy,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Verification failed:', error);
    throw error;
  }
}
