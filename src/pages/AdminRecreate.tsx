import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function AdminRecreate() {
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const email = 'info@construction.com';
  const password = 'Password123';

  const handleCreate = async () => {
    setCreating(true);
    setResult(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: 'System Administrator' },
        },
      });

      if (error) {
        const msg = typeof error.message === 'string' ? error.message : 'Signup failed';
        setResult({ success: false, message: msg });
        toast.error(msg);
        return;
      }

      const createdUser = (data as any)?.user;

      if (createdUser?.id) {
        // Try to create a profile row (best-effort)
        try {
          await supabase.from('profiles').upsert({
            id: createdUser.id,
            email,
            full_name: 'System Administrator',
            role: 'admin',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } catch {}
      }

      const needsConfirm = !(data as any)?.session;
      const finalMsg = needsConfirm
        ? 'User created. If email confirmations are enabled, please confirm the email in Supabase.'
        : 'User created and signed in.';

      setResult({ success: true, message: finalMsg });
      toast.success('Admin user created');
    } catch (e: any) {
      const msg = e?.message || 'Unexpected error creating user';
      setResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Recreate Admin User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will create the admin account:
          </p>
          <div className="rounded-md border p-3 text-sm">
            <div><strong>Email:</strong> {email}</div>
            <div><strong>Password:</strong> {password}</div>
          </div>

          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? 'Creating…' : 'Create Admin'}
          </Button>

          {result && (
            <Alert className={result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground">
            Note: Email provider must be enabled in Supabase. If confirmations are on, confirm the email in the Dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
