import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { hasFeature, getAllowedFeatures } from '@/utils/rolePermissions';
import type { FeatureKey, UserRole } from '@/utils/rolePermissions';
import { toast } from 'sonner';
import { parseErrorMessage } from '@/utils/errorHelpers';
import { Loader2, Search, Shield, Save, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ALL_FEATURES: { key: FeatureKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'customers', label: 'Customers' },
  { key: 'products', label: 'Products' },
  { key: 'quotations', label: 'Quotations' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'delivery-notes', label: 'Delivery Notes' },
  { key: 'cash-receipts', label: 'Cash Receipts' },
  { key: 'boqs', label: 'BOQs' },
  { key: 'payments', label: 'Payments' },
  { key: 'audit-logs', label: 'Audit Logs' },
  { key: 'reports-overview', label: 'Reports Overview' },
  { key: 'reports-sales', label: 'Sales Reports' },
  { key: 'reports-inventory', label: 'Inventory Reports' },
  { key: 'reports-statements', label: 'Statement of Accounts' },
  { key: 'settings-company', label: 'Company Settings' },
  { key: 'settings-users', label: 'User Management' },
  { key: 'manage-permissions', label: 'Manage Permissions' },
];

interface UserWithPermissions {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  status: string;
  overrides: Record<string, boolean>;
  changed: boolean;
}

export default function UserPermissions() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadUsers = useCallback(async () => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, status')
        .eq('company_id', profile.company_id)
        .order('email');

      if (profileError) throw profileError;
      const userIds = (profiles || []).map(p => p.id);

      let permMap: Record<string, Record<string, boolean>> = {};
      if (userIds.length > 0) {
        const { data: perms, error: permError } = await supabase
          .from('user_permissions')
          .select('user_id, permission_name, granted')
          .in('user_id', userIds);

        if (permError) throw permError;

        for (const p of perms || []) {
          if (!permMap[p.user_id]) permMap[p.user_id] = {};
          permMap[p.user_id][p.permission_name] = p.granted;
        }
      }

      setUsers((profiles || []).map(p => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role as UserRole,
        status: p.status,
        overrides: permMap[p.id] || {},
        changed: false,
      })));
    } catch (err) {
      toast.error(`Failed to load: ${parseErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const toggleOverride = (userId: string, feature: FeatureKey) => {
    setUsers(prev => prev.map(u =>
      u.id === userId
        ? { ...u, overrides: { ...u.overrides, [feature]: !u.overrides[feature] }, changed: true }
        : u
    ));
  };

  const savePermissions = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    setSaving(userId);
    try {
      const roleDefaults = getAllowedFeatures(user.role);
      const overrides = Object.entries(user.overrides)
        .filter(([key, granted]) => {
          const defaultValue = roleDefaults.includes(key as FeatureKey);
          return granted !== defaultValue;
        });

      await supabase.from('user_permissions').delete().eq('user_id', userId);

      if (overrides.length > 0) {
        const { error } = await supabase.from('user_permissions').insert(
          overrides.map(([permission_name, granted]) => ({
            user_id: userId,
            permission_name,
            granted,
            granted_by: profile?.id,
          }))
        );
        if (error) throw error;
      }

      toast.success(`Saved for ${user.full_name || user.email}`);
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, changed: false } : u
      ));
    } catch (err) {
      toast.error(`Save failed: ${parseErrorMessage(err)}`);
    } finally {
      setSaving(null);
    }
  };

  const isOverridden = (user: UserWithPermissions, feature: FeatureKey): boolean | null => {
    if (feature in user.overrides) return user.overrides[feature];
    return null;
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!profile?.company_id) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your admin profile doesn't have a company assigned. Contact a super admin to set your company_id.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Permissions</h1>
          <p className="text-muted-foreground">Click any feature to override the role-based default for that user</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No users found in your company
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredUsers.map(user => (
            <Card key={user.id} className={user.changed ? 'ring-2 ring-primary/50' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {(user.full_name || user.email).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{user.full_name || 'Unnamed'}</CardTitle>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{user.role.toUpperCase()}</Badge>
                    <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {user.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-muted">
                      {getAllowedFeatures(user.role).length} base
                    </Badge>
                    {user.changed && (
                      <Button size="sm" onClick={() => savePermissions(user.id)} disabled={saving === user.id}>
                        {saving === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                  {ALL_FEATURES.map(f => {
                    const override = isOverridden(user, f);
                    const hasByDefault = hasFeature(user.role, f.key);
                    const isGranted = override !== null ? override : hasByDefault;

                    let btnClass = isGranted
                      ? 'bg-primary text-primary-foreground hover:bg-primary/80'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80';

                    if (override !== null && isGranted !== hasByDefault) {
                      btnClass = isGranted
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300';
                    }

                    return (
                      <button
                        key={f.key}
                        onClick={() => toggleOverride(user.id, f.key)}
                        className={`px-2 py-1.5 rounded text-xs font-medium transition-colors text-left ${btnClass}`}
                        title={`${f.label}${override !== null ? ' (overridden)' : ''}`}
                      >
                        {f.label}
                        {override !== null && <span className="ml-1 text-[10px] opacity-60">*</span>}
                      </button>
                    );
                  })}
                </div>
                {Object.keys(user.overrides).length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    No overrides — all permissions derived from role
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sync All from Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Remove all overrides for users in this company and re-sync from role definitions.
          </p>
          <Button variant="outline" size="sm" onClick={async () => {
            if (!confirm('Clear all permission overrides for your company?')) return;
            setLoading(true);
            try {
              const userIds = users.map(u => u.id);
              if (userIds.length > 0) {
                await supabase.from('user_permissions').delete().in('user_id', userIds);
              }
              await loadUsers();
              toast.success('Overrides cleared');
            } catch (err) {
              toast.error(`Sync failed: ${parseErrorMessage(err)}`);
            } finally {
              setLoading(false);
            }
          }}>
            <Shield className="h-4 w-4 mr-2" />
            Clear Overrides
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
