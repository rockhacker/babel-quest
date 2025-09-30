import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Package, 
  QrCode, 
  Copy, 
  CheckCircle, 
  Database, 
  Activity 
} from 'lucide-react';

interface Stats {
  brands: number;
  types: number;
  originals: number;
  originalsFree: number;
  replicas: number;
  replicasScanned: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    brands: 0,
    types: 0,
    originals: 0,
    originalsFree: 0,
    replicas: 0,
    replicasScanned: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { apiRequest } = await import('@/lib/api');
      const response = await apiRequest('/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: '品牌数量',
      value: stats.brands,
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: '类型数量',
      value: stats.types,
      icon: Database,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: '原始码总数',
      value: stats.originals,
      icon: QrCode,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: '可用原始码',
      value: stats.originalsFree,
      icon: Activity,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: '副本码总数',
      value: stats.replicas,
      icon: Copy,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: '已扫描副本',
      value: stats.replicasScanned,
      icon: CheckCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">仪表盘</h2>
          <p className="text-muted-foreground">系统运行状态总览</p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-muted rounded-lg"></div>
                  <div className="space-y-2">
                    <div className="w-20 h-4 bg-muted rounded"></div>
                    <div className="w-16 h-6 bg-muted rounded"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">仪表盘</h2>
        <p className="text-muted-foreground">系统运行状态总览</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card, index) => (
          <Card key={index} className="group hover:shadow-hover transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-lg ${card.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                  <card.icon className={`h-6 w-6 ${card.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold text-foreground">{card.value.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <QrCode className="h-5 w-5 text-primary" />
              <span>库存状态</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">总原始码</span>
              <span className="font-semibold text-foreground">{stats.originals}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">可用原始码</span>
              <span className="font-semibold text-success">{stats.originalsFree}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">已绑定原始码</span>
              <span className="font-semibold text-warning">{stats.originals - stats.originalsFree}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-gradient-primary h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: stats.originals > 0 ? `${((stats.originals - stats.originalsFree) / stats.originals) * 100}%` : '0%' 
                }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Copy className="h-5 w-5 text-primary" />
              <span>副本状态</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">总副本码</span>
              <span className="font-semibold text-foreground">{stats.replicas}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">已扫描副本</span>
              <span className="font-semibold text-destructive">{stats.replicasScanned}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">待扫描副本</span>
              <span className="font-semibold text-success">{stats.replicas - stats.replicasScanned}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-destructive to-destructive-hover h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: stats.replicas > 0 ? `${(stats.replicasScanned / stats.replicas) * 100}%` : '0%' 
                }}
              ></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;