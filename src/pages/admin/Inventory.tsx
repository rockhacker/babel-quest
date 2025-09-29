import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  QrCode, 
  Plus, 
  Camera, 
  Trash2, 
  Package, 
  Download,
  AlertTriangle,
  CheckCircle,
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

interface Original {
  id: string;
  brand_id: string;
  type_id: string;
  url: string;
  scanned: boolean;
  scanned_at: string | null;
  rid: string;
  brands: { name: string };
  types: { name: string };
}

const Inventory: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [types, setTypes] = useState<Type[]>([]);
  const [originals, setOriginals] = useState<Original[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  
  // 筛选状态
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [scannedFilter, setScannedFilter] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  
  // 表单状态
  const [formBrandId, setFormBrandId] = useState('');
  const [formTypeId, setFormTypeId] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedBrandId || selectedTypeId || scannedFilter) {
      fetchOriginals(true);
    }
  }, [selectedBrandId, selectedTypeId, scannedFilter]);

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
      
      await fetchOriginals(true);
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

  const fetchOriginals = async (reset = false) => {
    try {
      const params = new URLSearchParams();
      if (selectedBrandId) params.append('brandId', selectedBrandId);
      if (selectedTypeId) params.append('typeId', selectedTypeId);
      if (scannedFilter) params.append('scanned', scannedFilter);
      if (!reset && nextCursor) params.append('cursor', nextCursor);
      
      const response = await fetch(`/api/originals?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (reset) {
          setOriginals(data.items);
        } else {
          setOriginals(prev => [...prev, ...data.items]);
        }
        setNextCursor(data.nextCursor);
      }
    } catch (error) {
      console.error('Failed to fetch originals:', error);
    }
  };

  const handleAddOriginal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formBrandId || !formTypeId || !qrUrl.trim()) {
      toast({
        title: "输入错误",
        description: "请填写所有字段",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/originals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          brandId: formBrandId, 
          typeId: formTypeId, 
          url: qrUrl.trim() 
        }),
      });

      const data = await response.json();
      
      if (data.ok) {
        toast({
          title: "入库成功",
          description: data.msg || "原始码已入库",
        });
        setQrUrl('');
        fetchOriginals(true);
      } else {
        toast({
          title: "入库失败",
          description: data.msg || "入库失败",
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

  const handleBulkDelete = async () => {
    if (!selectedBrandId || !selectedTypeId) {
      toast({
        title: "删除失败",
        description: "请先选择品牌和类型",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('确定要删除当前筛选条件下的所有原始码吗？此操作不可撤销。')) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/originals/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          brandId: selectedBrandId, 
          typeId: selectedTypeId 
        }),
      });

      const data = await response.json();
      
      if (data.ok) {
        toast({
          title: "删除成功",
          description: `已删除 ${data.deleted} 条原始码`,
        });
        fetchOriginals(true);
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

  const startScanning = async () => {
    setScanning(true);
    try {
      // 检查浏览器是否支持 BarcodeDetector
      if ('BarcodeDetector' in window) {
        await scanWithBarcodeDetector();
      } else {
        // 回退到摄像头预览 + 手动输入
        await scanWithCamera();
      }
    } catch (error) {
      console.error('Scanning error:', error);
      toast({
        title: "扫码失败",
        description: "无法启动摄像头或扫码功能",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  const scanWithBarcodeDetector = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();

    const barcodeDetector = new (window as any).BarcodeDetector({
      formats: ['qr_code']
    });

    const detectLoop = async () => {
      try {
        const barcodes = await barcodeDetector.detect(video);
        if (barcodes.length > 0) {
          const qrContent = barcodes[0].rawValue;
          setQrUrl(qrContent);
          
          // 自动提交
          if (formBrandId && formTypeId) {
            const response = await fetch('/api/originals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                brandId: formBrandId, 
                typeId: formTypeId, 
                url: qrContent 
              }),
            });
            
            const data = await response.json();
            toast({
              title: data.ok ? "扫码入库成功" : "扫码入库失败",
              description: data.msg || (data.ok ? "已自动入库" : "入库失败"),
              variant: data.ok ? "default" : "destructive",
            });
            
            if (data.ok) {
              fetchOriginals(true);
            }
          }
          
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        if (scanning) {
          requestAnimationFrame(detectLoop);
        }
      } catch (error) {
        console.error('Detection error:', error);
      }
    };

    detectLoop();
  };

  const scanWithCamera = async () => {
    // 简化版：启动摄像头预览，用户手动输入
    toast({
      title: "扫码模式",
      description: "请手动输入扫描到的二维码内容",
    });
  };

  const getFilteredTypes = () => {
    if (!selectedBrandId) return types;
    return types.filter(type => type.brand_id === selectedBrandId);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">库存池</h2>
          <p className="text-muted-foreground">管理原始二维码库存</p>
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
        <h2 className="text-2xl font-bold text-foreground mb-2">库存池</h2>
        <p className="text-muted-foreground">管理原始二维码库存</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 入库表单 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5 text-primary" />
              <span>入库原始码</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddOriginal} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="formBrand">品牌</Label>
                  <Select value={formBrandId} onValueChange={setFormBrandId}>
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
                  <Label htmlFor="formType">类型</Label>
                  <Select 
                    value={formTypeId} 
                    onValueChange={setFormTypeId}
                    disabled={!formBrandId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {types
                        .filter(type => type.brand_id === formBrandId)
                        .map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="qrUrl">二维码URL</Label>
                <div className="flex space-x-2">
                  <Input
                    id="qrUrl"
                    value={qrUrl}
                    onChange={(e) => setQrUrl(e.target.value)}
                    placeholder="请输入或扫描二维码URL"
                    disabled={submitting}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startScanning}
                    disabled={scanning || submitting}
                  >
                    {scanning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <Button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-gradient-primary hover:bg-primary-hover"
              >
                {submitting ? '入库中...' : '入库'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 筛选和批量操作 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-primary" />
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
                    <SelectItem value="0">未绑定</SelectItem>
                    <SelectItem value="1">已绑定</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

      {/* 库存列表 */}
      <Card>
        <CardHeader>
          <CardTitle>库存列表</CardTitle>
        </CardHeader>
        <CardContent>
          {originals.length === 0 ? (
            <div className="text-center py-8">
              <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">暂无库存</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-4">ID</th>
                      <th className="text-left py-2 px-4">品牌</th>
                      <th className="text-left py-2 px-4">类型</th>
                      <th className="text-left py-2 px-4">URL</th>
                      <th className="text-left py-2 px-4">状态</th>
                      <th className="text-left py-2 px-4">扫描时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {originals.map((original) => (
                      <tr key={original.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-4 font-mono text-sm">{original.rid}</td>
                        <td className="py-3 px-4">{original.brands.name}</td>
                        <td className="py-3 px-4">{original.types.name}</td>
                        <td className="py-3 px-4">
                          <div className="max-w-xs truncate" title={original.url}>
                            {original.url}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={original.scanned ? "destructive" : "default"}>
                            {original.scanned ? (
                              <div className="flex items-center space-x-1">
                                <AlertTriangle className="h-3 w-3" />
                                <span>已绑定</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1">
                                <CheckCircle className="h-3 w-3" />
                                <span>可用</span>
                              </div>
                            )}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {original.scanned_at 
                            ? new Date(original.scanned_at).toLocaleString()
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
                    onClick={() => fetchOriginals(false)}
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

export default Inventory;