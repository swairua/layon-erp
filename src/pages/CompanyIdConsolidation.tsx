import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Database,
  BarChart3,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  auditCompanyIds,
  consolidateCompanyIds,
  verifyConsolidation,
  type AuditResult,
  type VerificationResult,
} from '@/services/companyIdConsolidation';

export default function CompanyIdConsolidation() {
  const [phase, setPhase] = useState<'menu' | 'audit' | 'consolidate' | 'verify'>(
    'menu'
  );
  const [auditData, setAuditData] = useState<AuditResult | null>(null);
  const [verifyData, setVerifyData] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAudit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await auditCompanyIds();
      setAuditData(result);
      setPhase('audit');
      toast.success('Audit complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Audit failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsolidate = async () => {
    if (!auditData?.canonicalCompanyId) {
      setError('No canonical company found');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await consolidateCompanyIds();
      if (result.success) {
        toast.success(result.message);
        setPhase('verify');
        // Run verification immediately
        const verification = await verifyConsolidation();
        setVerifyData(verification);
      } else {
        setError(result.message);
        toast.error(result.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Consolidation failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await verifyConsolidation();
      setVerifyData(result);
      setPhase('verify');
      if (result.isHealthy) {
        toast.success('✅ Database is healthy - all company_ids consolidated!');
      } else {
        toast.warning('⚠️ Some issues remain. Review details below.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setPhase('menu');
    setAuditData(null);
    setVerifyData(null);
    setError(null);
  };

  const copyMigrationSQL = () => {
    const sql = `-- Phase 1 Audit
SELECT 'AUDIT: Companies Table' as audit_step, id, name, created_at FROM companies ORDER BY created_at ASC;

-- Run this in Supabase SQL Editor to apply migration
-- File: supabase/migrations/20250612_audit_company_id_consolidation.sql`;

    navigator.clipboard.writeText(sql);
    toast.success('SQL copied to clipboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">
              Company ID Consolidation
            </h1>
          </div>
          <p className="text-gray-600">
            Audit and fix company_id inconsistencies across all tables
          </p>
        </div>

        {/* Three-Phase Progress */}
        {phase !== 'menu' && (
          <div className="mb-8 grid grid-cols-3 gap-4">
            {['Phase 1: Audit', 'Phase 2: Consolidate', 'Phase 3: Verify'].map(
              (p, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-lg border-2 text-center font-semibold ${
                    (phase === 'audit' && i === 0) ||
                    (phase === 'consolidate' && i === 1) ||
                    (phase === 'verify' && i >= 1)
                      ? 'bg-green-100 border-green-400 text-green-900'
                      : phase === 'menu' || (i > 0 && phase === 'audit')
                        ? 'bg-gray-100 border-gray-300 text-gray-600'
                        : 'bg-blue-100 border-blue-400 text-blue-900'
                  }`}
                >
                  {p}
                </div>
              )
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {/* Menu */}
          {phase === 'menu' && (
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                What would you like to do?
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Audit Option */}
                <div className="p-6 rounded-lg border-2 border-blue-200 bg-blue-50">
                  <div className="flex items-start gap-3 mb-3">
                    <BarChart3 className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-lg text-blue-900">
                        Phase 1: Audit Database
                      </h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Scan all tables for NULL, mismatched, or orphaned
                        company_id values
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleAudit}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4"
                  >
                    {isLoading ? 'Running Audit...' : 'Run Audit'}
                  </Button>
                </div>

                {/* Info Option */}
                <div className="p-6 rounded-lg border-2 border-indigo-200 bg-indigo-50">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertCircle className="h-6 w-6 text-indigo-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-lg text-indigo-900">
                        SQL Migration File
                      </h3>
                      <p className="text-sm text-indigo-700 mt-1">
                        View the complete migration or apply via Supabase
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-indigo-600 font-mono bg-white p-2 rounded border border-indigo-200">
                      supabase/migrations/
                      <br />
                      20250612_audit_company_id_consolidation.sql
                    </p>
                    <Button
                      onClick={copyMigrationSQL}
                      variant="outline"
                      className="w-full border-indigo-300 text-indigo-600 hover:bg-indigo-100"
                    >
                      <Copy className="h-4 w-4" />
                      Copy Migration Info
                    </Button>
                  </div>
                </div>
              </div>

              {/* Info Section */}
              <div className="mt-8 p-6 bg-yellow-50 border border-yellow-300 rounded-lg">
                <h3 className="font-bold text-yellow-900 mb-3">
                  ℹ️ What This Tool Does
                </h3>
                <ul className="space-y-2 text-sm text-yellow-900">
                  <li>
                    ✅ <strong>Phase 1:</strong> Audits database to find the
                    canonical (oldest) company and identifies inconsistencies
                  </li>
                  <li>
                    ✅ <strong>Phase 2:</strong> Consolidates all NULL and
                    orphaned company_id values to the canonical company
                  </li>
                  <li>
                    ✅ <strong>Phase 3:</strong> Verifies all records now use
                    the same company_id
                  </li>
                </ul>
              </div>

              {/* Supabase Link */}
              <div className="mt-6 p-4 bg-gray-50 border border-gray-300 rounded-lg">
                <p className="text-sm text-gray-600 mb-3">
                  <strong>Manual Alternative:</strong> Apply the migration
                  directly in Supabase
                </p>
                <Button
                  onClick={() =>
                    window.open(
                      'https://app.supabase.com/project/eubrvlzkvzevidivsfha/sql/new',
                      '_blank'
                    )
                  }
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Supabase SQL Editor
                </Button>
              </div>
            </div>
          )}

          {/* Audit Results */}
          {phase === 'audit' && auditData && (
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                Audit Results
              </h2>

              {/* Canonical Company */}
              <div className="mb-6 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-bold text-green-900">
                    Canonical Company
                  </h3>
                </div>
                <p className="text-sm text-green-700">
                  ID: <code className="bg-white px-2 py-1 rounded border">
                    {auditData.canonicalCompanyId}
                  </code>
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Total Companies: {auditData.totalCompanies}
                </p>
              </div>

              {/* Issues Found */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 border-2 border-red-200 bg-red-50 rounded-lg">
                  <h4 className="font-bold text-red-900 mb-2">
                    Profiles Issues
                  </h4>
                  <p className="text-sm text-red-700">
                    NULL company_id: {auditData.profilesWithNull}
                  </p>
                </div>

                <div className="p-4 border-2 border-red-200 bg-red-50 rounded-lg">
                  <h4 className="font-bold text-red-900 mb-2">
                    Customers Issues
                  </h4>
                  <p className="text-sm text-red-700">
                    NULL: {auditData.customersAnomalies.nullCount} | Orphaned:{' '}
                    {auditData.customersAnomalies.distinctCompanies > 1
                      ? 'Yes'
                      : 'No'}
                  </p>
                </div>

                <div className="p-4 border-2 border-red-200 bg-red-50 rounded-lg">
                  <h4 className="font-bold text-red-900 mb-2">BOQs Issues</h4>
                  <p className="text-sm text-red-700">
                    NULL: {auditData.boqsAnomalies.nullCount} | Orphaned:{' '}
                    {auditData.boqsAnomalies.distinctCompanies > 1
                      ? 'Yes'
                      : 'No'}
                  </p>
                </div>

                <div className="p-4 border-2 border-red-200 bg-red-50 rounded-lg">
                  <h4 className="font-bold text-red-900 mb-2">
                    Invoices Issues
                  </h4>
                  <p className="text-sm text-red-700">
                    NULL: {auditData.invoicesAnomalies.nullCount} | Orphaned:{' '}
                    {auditData.invoicesAnomalies.distinctCompanies > 1
                      ? 'Yes'
                      : 'No'}
                  </p>
                </div>
              </div>

              {/* Profile Distribution */}
              {Object.keys(auditData.profileDistribution).length > 0 && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-300 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-3">
                    Profile Distribution by Company
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(auditData.profileDistribution).map(
                      ([company, count]) => (
                        <div key={company} className="text-sm">
                          <span className="text-gray-600">
                            {company === 'NULL'
                              ? '(NULL)'
                              : company.substring(0, 8)}
                            ...
                          </span>
                          : <span className="font-mono">{count}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleConsolidate}
                  disabled={isLoading}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {isLoading ? 'Processing...' : 'Phase 2: Consolidate'}
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="flex-1"
                >
                  Back to Menu
                </Button>
              </div>
            </div>
          )}

          {/* Verification Results */}
          {phase === 'verify' && verifyData && (
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                Verification Results
              </h2>

              {/* Health Status */}
              <div
                className={`mb-6 p-6 rounded-lg border-2 ${
                  verifyData.isHealthy
                    ? 'bg-green-50 border-green-300'
                    : 'bg-yellow-50 border-yellow-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  {verifyData.isHealthy ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-yellow-600" />
                  )}
                  <h3
                    className={`text-xl font-bold ${
                      verifyData.isHealthy
                        ? 'text-green-900'
                        : 'text-yellow-900'
                    }`}
                  >
                    {verifyData.isHealthy
                      ? '✅ Consolidation Successful!'
                      : '⚠️ Some Issues Detected'}
                  </h3>
                </div>
                <p
                  className={`text-sm ${
                    verifyData.isHealthy
                      ? 'text-green-700'
                      : 'text-yellow-700'
                  }`}
                >
                  {verifyData.isHealthy
                    ? 'All company_ids are now consolidated to a single canonical company.'
                    : 'Review the details below for remaining issues.'}
                </p>
              </div>

              {/* Verification Details */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-bold text-gray-900 mb-2">
                    Profiles with NULL company_id
                  </h4>
                  <p className="text-3xl font-bold text-gray-600">
                    {verifyData.profilesWithNull}
                  </p>
                  {verifyData.profilesWithNull === 0 && (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-2" />
                  )}
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-bold text-gray-900 mb-2">
                    Customers with NULL company_id
                  </h4>
                  <p className="text-3xl font-bold text-gray-600">
                    {verifyData.customersWithNull}
                  </p>
                  {verifyData.customersWithNull === 0 && (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-2" />
                  )}
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-bold text-gray-900 mb-2">
                    BOQs with NULL company_id
                  </h4>
                  <p className="text-3xl font-bold text-gray-600">
                    {verifyData.boqsWithNull}
                  </p>
                  {verifyData.boqsWithNull === 0 && (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-2" />
                  )}
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-bold text-gray-900 mb-2">
                    Invoices with NULL company_id
                  </h4>
                  <p className="text-3xl font-bold text-gray-600">
                    {verifyData.invoicesWithNull}
                  </p>
                  {verifyData.invoicesWithNull === 0 && (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-2" />
                  )}
                </div>

                <div className="p-4 border rounded-lg md:col-span-2">
                  <h4 className="font-bold text-gray-900 mb-2">
                    Distinct Companies Across All Tables
                  </h4>
                  <p className="text-3xl font-bold text-gray-600">
                    {verifyData.distinctCompaniesAcrossAll}
                  </p>
                  {verifyData.distinctCompaniesAcrossAll === 1 && (
                    <p className="text-sm text-green-700 mt-2">
                      ✅ Single canonical company confirmed
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Next Steps */}
              {verifyData.isHealthy && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-300 rounded-lg">
                  <h3 className="font-bold text-blue-900 mb-2">Next Steps</h3>
                  <ul className="space-y-1 text-sm text-blue-700">
                    <li>✅ BOQs page should now load correctly</li>
                    <li>✅ All company_id references are consistent</li>
                    <li>✅ Data integrity is maintained</li>
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleVerify}
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                  Re-verify
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="flex-1"
                >
                  Back to Menu
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-300 rounded-lg text-center text-sm text-blue-700">
          <p>
            For more information, see:{' '}
            <code className="bg-white px-2 py-1 rounded border border-blue-300">
              supabase/migrations/20250612_audit_company_id_consolidation.sql
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
