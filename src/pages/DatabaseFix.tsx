import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { fixSalesUserCompanyId } from '@/services/adminFixData';

export default function DatabaseFix() {
  const [copied, setCopied] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);

  const SQL = `ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;`;

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(SQL);
      setCopied(true);
      alert('✅ SQL copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('Failed to copy. Please copy manually:\n\n' + SQL);
    }
  };

  const handleFixSalesUser = async () => {
    setFixLoading(true);
    try {
      const result = await fixSalesUserCompanyId();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } finally {
      setFixLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-2xl border-2 border-orange-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-100 to-orange-50 border-b-2 border-orange-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="h-8 w-8 text-orange-600" />
              <h1 className="text-3xl font-bold text-orange-900">Database Fix Required</h1>
            </div>
            <p className="text-orange-800">One-command fix for RLS recursion error</p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* The Problem */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900">
                <strong>Problem:</strong> The profiles table has RLS (Row Level Security) policies that are causing infinite recursion, blocking admin access.
              </p>
            </div>

            {/* The Solution */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-gray-900">The SQL Fix:</h3>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm border-2 border-gray-700 overflow-auto">
                {SQL}
              </div>
              <Button
                onClick={handleCopy}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 text-base"
              >
                <Copy className="h-5 w-5" />
                {copied ? '✅ Copied to Clipboard!' : 'Copy SQL Command'}
              </Button>
            </div>

            {/* Steps */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Steps to Apply:
              </h3>
              <ol className="space-y-2 text-sm text-blue-900">
                <li><span className="font-bold bg-blue-200 px-2 py-1 rounded">1</span> Click "Open Supabase" button below</li>
                <li><span className="font-bold bg-blue-200 px-2 py-1 rounded">2</span> Navigate to <strong>SQL Editor</strong> (left sidebar)</li>
                <li><span className="font-bold bg-blue-200 px-2 py-1 rounded">3</span> Click <strong>New Query</strong></li>
                <li><span className="font-bold bg-blue-200 px-2 py-1 rounded">4</span> Paste the SQL (use the copy button above)</li>
                <li><span className="font-bold bg-blue-200 px-2 py-1 rounded">5</span> Press <strong>Ctrl+Enter</strong> to execute</li>
                <li><span className="font-bold bg-blue-200 px-2 py-1 rounded">6</span> Wait for success confirmation</li>
                <li><span className="font-bold bg-blue-200 px-2 py-1 rounded">7</span> Refresh this browser window (Ctrl+R or Cmd+R)</li>
              </ol>
            </div>

            {/* Open Supabase Button */}
            <Button
              onClick={() => {
                window.open('https://app.supabase.com', '_blank');
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 text-base"
            >
              <ExternalLink className="h-5 w-5" />
              Open Supabase Dashboard
            </Button>

            {/* What This Does */}
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-2">What This Fixes:</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>✅ Disables problematic RLS policies on profiles table</li>
                <li>✅ Removes infinite recursion in policy evaluation</li>
                <li>✅ Allows profile data to be fetched normally</li>
                <li>✅ Authorization moved to application level</li>
              </ul>
            </div>

            {/* Next Steps */}
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
              <h3 className="font-bold text-yellow-900 mb-2">After Applying:</h3>
              <p className="text-sm text-yellow-900">
                Once the SQL runs successfully, refresh your browser. Then navigate to <strong>Settings → User Management</strong>
                and the Admin Diagnostics tool will work to set your admin role.
              </p>
            </div>

            {/* Sales User Fix */}
            <div className="border-t-2 border-gray-200 pt-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                Fix Sales User Missing from User Management
              </h2>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-green-900">
                  <strong>Issue:</strong> The Sales user (sales@layonsconstruction.com) is missing from the user management table because their company_id is null.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-lg text-gray-900">Apply Fix:</h3>
                <p className="text-sm text-gray-700">
                  This will update the Sales user's company_id to match the System Administrator's company, making them visible in the user management table.
                </p>
                <Button
                  onClick={handleFixSalesUser}
                  disabled={fixLoading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 text-base"
                >
                  <CheckCircle className="h-5 w-5" />
                  {fixLoading ? 'Applying Fix...' : 'Fix Sales User Company ID'}
                </Button>
              </div>

              <div className="mt-4 bg-green-50 border border-green-300 rounded-lg p-4">
                <h3 className="font-bold text-green-900 mb-2">What This Does:</h3>
                <ul className="space-y-1 text-sm text-green-900">
                  <li>✅ Updates Sales user company_id from null</li>
                  <li>✅ Aligns with System Administrator's company</li>
                  <li>✅ Makes Sales user visible in User Management</li>
                  <li>✅ Increases total user count from 1 to 2</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
