import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, Tags, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Brand {
  id: string;
  name: string;
  created_at: string;
}

interface Type {
  id: string;
  brand_id: string;
  name: string;
  brands: { name: string };
}

const Catalog: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [types, setTypes] = useState<Type[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandName, setBrandName] = useState('');
  const [typeName, setTypeName] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [brandsRes, typesRes] = await Promise.all([
        fetch('/api/brands', { credentials: 'include' }),
        fetch('/api/types', { credentials: 'include' }),
      ]);

      if (brandsRes.ok && typesRes.ok) {
        const brandsData = await brandsRes.json();
        const typesData = await typesRes.json();
        setBrands(brandsData);
        setTypes(typesData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({
        title: "加载失败",
        description: "无法加载品牌和类型数据",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!brandName.trim()) {
      toast({
        title: "输入错误",
        description: "请输入品牌名称",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: brandName.trim() }),
      });

      const data = await response.json();
      
      if (data.ok) {
        toast({
          title: "创建成功",
          description: "品牌已创建",
        });
        setBrandName('');
        fetchData();
      } else {
        toast({
          title: "创建失败",
          description: data.msg || "创建品牌失败",
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

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBrandId || !typeName.trim()) {
      toast({
        title: "输入错误",
        description: "请选择品牌并输入类型名称",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          brandId: selectedBrandId, 
          name: typeName.trim() 
        }),
      });

      const data = await response.json();
      
      if (data.ok) {
        toast({
          title: "创建成功",
          description: "类型已创建",
        });
        setTypeName('');
        setSelectedBrandId('');
        fetchData();
      } else {
        toast({
          title: "创建失败",
          description: data.msg || "创建类型失败",
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

  const handleDeleteBrand = async (brandId: string, brandName: string) => {
    if (!confirm(`确定要删除品牌"${brandName}"吗？此操作不可撤销。`)) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/brands/${brandId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      
      if (data.ok) {
        toast({
          title: "删除成功",
          description: "品牌已删除",
        });
        fetchData();
      } else {
        toast({
          title: "删除失败",
          description: data.msg || "删除品牌失败",
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

  const handleDeleteType = async (typeId: string, typeName: string) => {
    if (!confirm(`确定要删除类型"${typeName}"吗？此操作不可撤销。`)) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/types/${typeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      
      if (data.ok) {
        toast({
          title: "删除成功",
          description: "类型已删除",
        });
        fetchData();
      } else {
        toast({
          title: "删除失败",
          description: data.msg || "删除类型失败",
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

  const getTypesByBrand = (brandId: string) => {
    return types.filter(type => type.brand_id === brandId);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">品牌与类型</h2>
          <p className="text-muted-foreground">管理品牌和类型分类</p>
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
        <h2 className="text-2xl font-bold text-foreground mb-2">品牌与类型</h2>
        <p className="text-muted-foreground">管理品牌和类型分类</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 新建品牌 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-primary" />
              <span>新建品牌</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateBrand} className="space-y-4">
              <div>
                <Label htmlFor="brandName">品牌名称</Label>
                <Input
                  id="brandName"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="请输入品牌名称"
                  disabled={submitting}
                />
              </div>
              <Button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-gradient-primary hover:bg-primary-hover"
              >
                <Plus className="h-4 w-4 mr-2" />
                {submitting ? '创建中...' : '创建品牌'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 为品牌添加类型 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Tags className="h-5 w-5 text-primary" />
              <span>为品牌添加类型</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateType} className="space-y-4">
              <div>
                <Label htmlFor="brandSelect">选择品牌</Label>
                <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择品牌" />
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
                <Label htmlFor="typeName">类型名称</Label>
                <Input
                  id="typeName"
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  placeholder="请输入类型名称"
                  disabled={submitting || brands.length === 0}
                />
              </div>
              <Button 
                type="submit" 
                disabled={submitting || brands.length === 0}
                className="w-full bg-gradient-primary hover:bg-primary-hover"
              >
                <Plus className="h-4 w-4 mr-2" />
                {submitting ? '创建中...' : '创建类型'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 品牌列表 */}
      <Card>
        <CardHeader>
          <CardTitle>品牌列表</CardTitle>
        </CardHeader>
        <CardContent>
          {brands.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">暂无品牌</p>
            </div>
          ) : (
            <div className="space-y-4">
              {brands.map((brand) => {
                const brandTypes = getTypesByBrand(brand.id);
                return (
                  <div key={brand.id} className="p-4 border border-border rounded-lg hover:shadow-card transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-foreground">{brand.name}</h3>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteBrand(brand.id, brand.name)}
                            disabled={submitting}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {brandTypes.length === 0 ? (
                            <span className="text-sm text-muted-foreground">暂无类型</span>
                          ) : (
                            brandTypes.map((type) => (
                              <div key={type.id} className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md">
                                <span className="text-sm text-secondary-foreground">{type.name}</span>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleDeleteType(type.id, type.name)}
                                  disabled={submitting}
                                  className="h-auto p-0 text-destructive hover:text-destructive hover:bg-destructive/10 ml-1"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground ml-4">
                        {brandTypes.length} 个类型
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Catalog;