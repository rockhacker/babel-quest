import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  BarChart3, 
  Package, 
  QrCode, 
  Copy, 
  LogOut, 
  Menu,
  X
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: '仪表盘', href: '/admin', icon: BarChart3 },
  { name: '品牌与类型', href: '/admin/catalog', icon: Package },
  { name: '库存池', href: '/admin/inventory', icon: QrCode },
  { name: '副本', href: '/admin/replicas', icon: Copy },
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNavigation = (href: string) => {
    navigate(href);
    setSidebarOpen(false);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
          {/* Logo 和关闭按钮 */}
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center space-x-3">
              <QrCode className="h-8 w-8 text-sidebar-primary" />
              <span className="text-xl font-bold text-sidebar-foreground">qrMax Admin</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* 导航菜单 */}
          <nav className="flex-1 space-y-2 px-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Button
                  key={item.name}
                  variant={isActive ? "default" : "ghost"}
                  className={`
                    w-full justify-start space-x-3 h-12
                    ${isActive 
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-primary' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                    }
                  `}
                  onClick={() => handleNavigation(item.href)}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Button>
              );
            })}
          </nav>

          {/* 用户信息和退出 */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center">
                  <span className="text-sm font-medium text-sidebar-primary-foreground">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-sidebar-foreground">{user.username}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="lg:pl-64">
        {/* 顶部导航栏 */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-foreground">
              {navigation.find(item => item.href === location.pathname)?.name || 'qrMax Admin'}
            </h1>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 p-4 lg:p-6">
          <Card className="bg-gradient-card shadow-card border-border">
            <CardContent className="p-6">
              {children}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};