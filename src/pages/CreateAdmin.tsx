import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function CreateAdmin() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const createAdminUser = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-admin', {
        body: {
          email: 'admin@qwe.com',
          password: 'Wkmlzc2202'
        }
      });

      if (error) {
        console.error('Error:', error);
        setResult({ error: error.message });
        toast.error('创建失败: ' + error.message);
      } else {
        console.log('Success:', data);
        setResult(data);
        if (data.ok) {
          toast.success('管理员账户创建成功！');
        } else {
          toast.error('创建失败: ' + (data.error || '未知错误'));
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setResult({ error: String(err) });
      toast.error('创建失败: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>创建管理员账户</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>邮箱: admin@qwe.com</p>
            <p>密码: Wkmlzc2202</p>
          </div>
          
          <Button 
            onClick={createAdminUser} 
            disabled={loading}
            className="w-full"
          >
            {loading ? '创建中...' : '创建管理员账户'}
          </Button>

          {result && (
            <div className="mt-4 p-4 rounded bg-muted">
              <pre className="text-xs overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
