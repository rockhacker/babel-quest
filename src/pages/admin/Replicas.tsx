import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Copy, 
  Plus, 
  Download, 
  Trash2, 
  ExternalLink,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Brand {
  id: string;
  name: string;
}

interface Type {
  id: string;
  brand_id: string;
  name: string;
  brands: { name: string };
}

interface Replica {
  id: string;
  brand_id: string;
  type_id: string;
  token: string;
  batch_id: string | null;
  scanned: boolean;
  scanned_at: string | null;
  url: string;
  brands: { name: string };
  types: { name: string };
}

interface ExportJob {
  id: string;
  status: 'pending' | 'processing' | 'finished' | 'failed';
  total: number;
  completed: number;
  progress: number;
  error?: string;
  downloadUrl?: string;
  startedAt?: string;
  finishedAt?: string;
}

const Replicas: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [types, setTypes] = useState<Type[]>([]);
  const [replicas, setReplicas] = useState<Replica[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // 筛选状态
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [scannedFilter, setScannedFilter] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  
  // 生成表单
  const [genBrandId, setGenBrandId] = useState('');
  const [genTypeId, setGenTypeId] = useState('');
  const [genCount, setGenCount] = useState('100');
  
  // 导出状态
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [exportPolling, setExportPolling] = useState(false);
  
  // 删除选项
  const [deleteWithOriginals, setDeleteWithOriginals] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedBrandId || selectedTypeId || scannedFilter) {
      fetchReplicas(true);
    }
  }, [selectedBrandId, selectedTypeId, scannedFilter]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (exportPolling && exportJob && ['pending', 'processing'].includes(exportJob.status)) {
      interval = setInterval(checkExportStatus, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [exportPolling, exportJob]);

  const fetchInitialData = async () => {
    try {
      const [brandsRes, typesRes] = await Promise.all([
        fetch('/api/brands'),
        fetch('/api/types'),
      ]);

      if (brandsRes.ok && typesRes.ok) {
        const brandsData = await brandsRes.json();
        const typesData = await typesRes.json();
        setBrands(brandsData);
        setTypes(typesData);
      }
      
      await fetchReplicas(true);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({
        title: "加载失败",
        description: "无法加载数据",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReplicas = async (reset = false) => {
    try {
      const params = new URLSearchParams();
      if (selectedBrandId) params.append('brandId', selectedBrandId);
      if (selectedTypeId) params.append('typeId', selectedTypeId);
      if (scannedFilter) params.append('scanned', scannedFilter);
      if (!reset && nextCursor) params.append('cursor', nextCursor);
      
      const response = await fetch(`/api/replicas?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (reset) {
          setReplicas(data.items);
        } else {
          setReplicas(prev => [...prev, ...data.items]);
        }
        setNextCursor(data.nextCursor);
      }
    } catch (error) {
      console.error('Failed to fetch replicas:', error);
    }
  };

  const handleGenerateReplicas = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!genBrandId || !genTypeId || !genCount) {
      toast({
        title: "输入错误",
        description: "请填写所有字段",
        variant: "destructive",
      });
      return;
    }

    const count = parseInt(genCount);
    if (isNaN(count) || count < 1 || count > 1000) {
      toast({
        title: "数量错误",
        description: "数量必须在1-1000之间",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/replicas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          brandId: genBrandId, 
          typeId: genTypeId, 
          count 
        }),
      });

      const data = await response.json();
      
      if (data.ok) {
        toast({
          title: "生成成功",
          description: `已生成 ${count} 个副本码`,
        });
        setGenCount('100');
        fetchReplicas(true);
      } else {
        toast({
          title: "生成失败",
          description: data.msg || "生成失败",
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
      setSubmitting(false);
    }
  };

  const handleExportZip = async () => {
    if (!selectedBrandId || !selectedTypeId) {
      toast({
        title: "导出失败",
        description: "请先选择品牌和类型",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/replica_export_jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          brandId: selectedBrandId, 
          typeId: selectedTypeId,
          baseUrl: window.location.origin
        }),
      });

      const data = await response.json();
      
      if (data.ok) {
        setExportJob({
          id: data.jobId,
          status: data.status,
          total: data.total,
          completed: data.completed,
          progress: 0
        });
        setExportPolling(true);
        toast({
          title: "导出任务已创建",
          description: "正在后台处理，请稍候...",
        });
      } else {
        toast({
          title: "导出失败",
          description: data.msg || "创建导出任务失败",
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
      setSubmitting(false);
    }
  };

  const checkExportStatus = async () => {
    if (!exportJob) return;

    try {
      const response = await fetch(`/api/replica_export_jobs/${exportJob.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          const updatedJob = {
            ...exportJob,
            status: data.status,
            total: data.total,
            completed: data.completed,
            progress: data.progress,
            error: data.error,
            downloadUrl: data.downloadUrl,
            startedAt: data.startedAt,
            finishedAt: data.finishedAt
          };
          
          setExportJob(updatedJob);
          
          if (data.status === 'finished') {
            setExportPolling(false);
            toast({
              title: "导出完成",
              description: "ZIP文件已准备就绪",
            });
          } else if (data.status === 'failed') {
            setExportPolling(false);
            toast({
              title: "导出失败",
              description: data.error || "导出过程中发生错误",
              variant: "destructive",
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to check export status:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedBrandId || !selectedTypeId) {
      toast({
        title: "删除失败",
        description: "请先选择品牌和类型",
        variant: "destructive",
      });
      return;
    }

    const confirmMsg = deleteWithOriginals 
      ? '确定要删除当前筛选条件下的所有副本码以及对应的原始码和批次吗？此操作不可撤销。'
      : '确定要删除当前筛选条件下的所有副本码吗？此操作不可撤销。';

    if (!confirm(confirmMsg)) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/replicas/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          brandId: selectedBrandId, 
          typeId: selectedTypeId,
          deleteOriginals: deleteWithOriginals
        }),
      });

      const data = await response.json();
      
      if (data.ok) {
        toast({
          title: "删除成功",
          description: `已删除 ${data.deleted} 条副本码`,
        });
        fetchReplicas(true);
      } else {
        toast({
          title: "删除失败",
          description: data.msg || "删除失败",
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
      setSubmitting(false);
    }
  };

  const getFilteredTypes = () => {
    if (!selectedBrandId) return types;
    return types.filter(type => type.brand_id === selectedBrandId);
  };

  const getGenFilteredTypes = () => {
    if (!genBrandId) return types;
    return types.filter(type => type.brand_id === genBrandId);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">副本管理</h2>
          <p className="text-muted-foreground">生成和管理副本二维码</p>
        </div>
        
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="w-32 h-6 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="w-full h-10 bg-muted rounded"></div>
                  <div className="w-24 h-10 bg-muted rounded"></div>
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
        <h2 className="text-2xl font-bold text-foreground mb-2">副本管理</h2>
        <p className="text-muted-foreground">生成和管理副本二维码</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 生成与导出 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5 text-primary" />
              <span>生成与导出</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerateReplicas} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>品牌</Label>
                  <Select value={genBrandId} onValueChange={setGenBrandId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择品牌" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>类型</Label>
                  <Select 
                    value={genTypeId} 
                    onValueChange={setGenTypeId}
                    disabled={!genBrandId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {getGenFilteredTypes().map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label>生成数量 (1-1000)</Label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={genCount}
                  onChange={(e) => setGenCount(e.target.value)}
                  disabled={submitting}
                />
              </div>
              
              <Button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-gradient-primary hover:bg-primary-hover"
              >
                {submitting ? '生成中...' : '生成副本'}
              </Button>
            </form>

            {/* 导出功能 */}
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="font-medium mb-4">导出ZIP</h4>
              
              {exportJob && (
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">导出进度</span>
                      <Badge variant={
                        exportJob.status === 'finished' ? 'default' :
                        exportJob.status === 'failed' ? 'destructive' :
                        'secondary'
                      }>
                        {exportJob.status === 'pending' && '等待中'}
                        {exportJob.status === 'processing' && '处理中'}
                        {exportJob.status === 'finished' && '已完成'}
                        {exportJob.status === 'failed' && '失败'}
                      </Badge>
                    </div>
                    
                    <Progress value={exportJob.progress} className="mb-2" />
                    
                    <div className="text-xs text-muted-foreground">
                      {exportJob.completed} / {exportJob.total} 已处理
                    </div>
                    
                    {exportJob.status === 'finished' && exportJob.downloadUrl && (
                      <Button 
                        className="w-full mt-3" 
                        onClick={() => window.open(exportJob.downloadUrl, '_blank')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        下载ZIP文件
                      </Button>
                    )}
                    
                    {exportJob.status === 'failed' && exportJob.error && (
                      <div className="text-sm text-destructive mt-2">
                        错误: {exportJob.error}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              
              <Button
                variant="outline"
                onClick={handleExportZip}
                disabled={submitting || !selectedBrandId || !selectedTypeId || exportPolling}
                className="w-full"
              >
                {exportPolling ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                创建导出任务
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 筛选与删除 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Copy className="h-5 w-5 text-primary" />
              <span>筛选与操作</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>品牌</Label>
                <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部品牌</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>类型</Label>
                <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部类型</SelectItem>
                    {getFilteredTypes().map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>状态</Label>
                <Select value={scannedFilter} onValueChange={setScannedFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部状态</SelectItem>
                    <SelectItem value="0">未扫描</SelectItem>
                    <SelectItem value="1">已扫描</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="deleteOriginals"
                checked={deleteWithOriginals}
                onCheckedChange={(checked) => setDeleteWithOriginals(checked === true)}
              />
              <Label htmlFor="deleteOriginals" className="text-sm">
                同时删除原始码与批次
              </Label>
            </div>
            
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={submitting || !selectedBrandId || !selectedTypeId}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              批量删除当前筛选结果
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 副本列表 */}
      <Card>
        <CardHeader>
          <CardTitle>副本列表</CardTitle>
        </CardHeader>
        <CardContent>
          {replicas.length === 0 ? (
            <div className="text-center py-8">
              <Copy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">暂无副本</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-4">Token</th>
                      <th className="text-left py-2 px-4">访问URL</th>
                      <th className="text-left py-2 px-4">品牌</th>
                      <th className="text-left py-2 px-4">类型</th>
                      <th className="text-left py-2 px-4">批次</th>
                      <th className="text-left py-2 px-4">状态</th>
                      <th className="text-left py-2 px-4">扫描时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {replicas.map((replica) => (
                      <tr key={replica.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-4 font-mono text-sm">
                          {replica.token.substring(0, 10)}...
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="max-w-xs truncate" title={replica.url}>
                              {replica.url}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(replica.url, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="py-3 px-4">{replica.brands.name}</td>
                        <td className="py-3 px-4">{replica.types.name}</td>
                        <td className="py-3 px-4 font-mono text-sm">
                          {replica.batch_id ? replica.batch_id.substring(0, 8) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={replica.scanned ? "destructive" : "default"}>
                            {replica.scanned ? (
                              <div className="flex items-center space-x-1">
                                <CheckCircle className="h-3 w-3" />
                                <span>已扫描</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1">
                                <Clock className="h-3 w-3" />
                                <span>待扫描</span>
                              </div>
                            )}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {replica.scanned_at 
                            ? new Date(replica.scanned_at).toLocaleString()
                            : '-'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {nextCursor && (
                <div className="text-center">
                  <Button
                    variant="outline"
                    onClick={() => fetchReplicas(false)}
                    disabled={submitting}
                  >
                    加载更多
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Replicas;