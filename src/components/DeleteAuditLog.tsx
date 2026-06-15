import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { usePagination } from '@/hooks/usePagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Search, AlertCircle, Trash2, Eye } from 'lucide-react';

interface DeletionLogRow {
  id: string;
  action: string;
  entity_type: string;
  actor_email: string | null;
  record_id: string | null;
  details: any;
  created_at: string | null;
}

export function DeleteAuditLog() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<DeletionLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedLog, setSelectedLog] = useState<DeletionLogRow | null>(null);

  useEffect(() => {
    if (!profile?.company_id) return;

    let cancelled = false;

    async function loadLogs() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('audit_logs')
          .select('id, action, entity_type, actor_email, record_id, details, created_at')
          .eq('company_id', profile.company_id)
          .eq('action', 'delete')
          .order('created_at', { ascending: false });

        if (cancelled) return;

        if (queryError) {
          setError(queryError.message);
        } else {
          setLogs(data || []);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load deletion logs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLogs();

    return () => { cancelled = true; };
  }, [profile?.company_id]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          (log.actor_email?.toLowerCase() || '').includes(q) ||
          log.entity_type.toLowerCase().includes(q) ||
          (log.record_id?.toLowerCase() || '').includes(q) ||
          JSON.stringify(log.details || {}).toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      if (dateFrom && log.created_at) {
        if (new Date(log.created_at) < new Date(dateFrom)) return false;
      }
      if (dateTo && log.created_at) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(log.created_at) > end) return false;
      }

      return true;
    });
  }, [logs, searchTerm, dateFrom, dateTo]);

  const { paginatedItems, currentPage, totalPages, pageSize, totalItems, setCurrentPage, setPageSize } =
    usePagination(filteredLogs, { initialPageSize: 25 });

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
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load deletion logs: {error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search deletions by entity type, actor, or record ID..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="pl-10 text-sm"
          />
        </div>

        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
            className="w-[140px] text-sm"
            placeholder="From"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
            className="w-[140px] text-sm"
            placeholder="To"
          />
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No deletion records found.</p>
            {(searchTerm || dateFrom || dateTo) ? (
              <p className="text-sm mt-1">Try adjusting your search or date filters.</p>
            ) : (
              <p className="text-sm mt-1">No records have been deleted yet.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/50">
                    <TableCell className="text-sm whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="capitalize">{log.entity_type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                      {log.actor_email || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">
                      {log.record_id ? log.record_id.substring(0, 8) + '...' : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deletion Record Details</DialogTitle>
            <DialogDescription>Full information about this deleted record</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground mb-1">Entity Type</p>
                  <p className="font-medium capitalize">{selectedLog.entity_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Deleted By</p>
                  <p>{selectedLog.actor_email || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Deleted At</p>
                  <p>{selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString() : '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground mb-1">Record ID</p>
                  <p className="font-mono text-xs">{selectedLog.record_id || '-'}</p>
                </div>
              </div>
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2">Deleted Data (JSON)</p>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap max-h-64">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
