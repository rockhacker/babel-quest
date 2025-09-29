import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/admin');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: "输入错误",
        description: "请输入用户名和密码",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const result = await login(username, password);
      
      if (result.success) {
        toast({
          title: "登录成功",
          description: "欢迎回来！",
        });
        navigate('/admin');
      } else {
        toast({
          title: "登录失败",
          description: result.error || "用户名或密码错误",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "网络错误",
        description: "请检查网络连接后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="bg-gradient-card shadow-card border-border">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex items-center space-x-3">
                <QrCode className="h-10 w-10 text-primary" />
                <span className="text-2xl font-bold text-foreground">qrMax Admin</span>
              </div>
            </div>
            <CardTitle className="text-xl text-foreground">管理员登录</CardTitle>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground">用户名</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                  placeholder="请输入用户名"
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                  placeholder="请输入密码"
                  disabled={loading}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-primary hover:bg-primary-hover shadow-primary"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    <span>登录中...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <LogIn className="h-4 w-4" />
                    <span>登录</span>
                  </div>
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                默认账号: admin / admin123
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;