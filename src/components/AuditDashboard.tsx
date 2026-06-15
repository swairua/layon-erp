import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Activity, Trash2, Plus, RefreshCw, Clock } from 'lucide-react';

interface AuditStats {
  total: number;
  creates: number;
  updates: number;
  deletes: number;
  byEntityType: Record<string, number>;
  recentActivity: { id: string; action: string; entity_type: string; actor_email: string | null; created_at: string }[];
}

export function AuditDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.company_id) return;

    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('audit_logs')
          .select('action, entity_type, actor_email, created_at, id')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false });

        if (cancelled) return;

        if (queryError) {
          setError(queryError.message);
          setLoading(false);
          return;
        }

        const logs = data || [];
        const creates = logs.filter(l => l.action === 'create').length;
        const updates = logs.filter(l => l.action === 'update').length;
        const deletes = logs.filter(l => l.action === 'delete').length;

        const byEntityType: Record<string, number> = {};
        logs.forEach(l => {
          byEntityType[l.entity_type] = (byEntityType[l.entity_type] || 0) + 1;
        });

        setStats({
          total: logs.length,
          creates,
          updates,
          deletes,
          byEntityType,
          recentActivity: logs.slice(0, 10),
        });
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load audit stats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStats();

    return () => { cancelled = true; };
  }, [profile?.company_id]);

  if (!profile?.company_id) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No company associated with your account.</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load audit data: {error}</AlertDescription>
      </Alert>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>No audit activity recorded yet.</p>
        <p className="text-sm mt-1">Actions will appear here as you create, update, or delete records.</p>
      </div>
    );
  }

  const topEntityTypes = Object.entries(stats.byEntityType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Activities</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <Activity className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Creations</p>
                <p className="text-3xl font-bold text-green-600">{stats.creates}</p>
              </div>
              <Plus className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Updates</p>
                <p className="text-3xl font-bold text-blue-600">{stats.updates}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deletions</p>
                <p className="text-3xl font-bold text-red-600">{stats.deletes}</p>
              </div>
              <Trash2 className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Activity by Entity Type</h3>
            {topEntityTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <div className="space-y-3">
                {topEntityTypes.map(([type, count]) => {
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize">{type}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Recent Activity</h3>
            {stats.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {stats.recentActivity.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium capitalize px-1.5 py-0.5 rounded text-xs ${
                          log.action === 'delete' ? 'bg-red-100 text-red-700' :
                          log.action === 'create' ? 'bg-green-100 text-green-700' :
                          log.action === 'update' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {log.action}
                        </span>
                        <span className="text-muted-foreground capitalize">{log.entity_type}</span>
                      </div>
                      <p className="text-muted-foreground truncate mt-0.5">
                        {log.actor_email || 'Unknown user'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
