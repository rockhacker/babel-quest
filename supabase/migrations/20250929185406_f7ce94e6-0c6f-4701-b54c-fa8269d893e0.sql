-- 创建品牌表
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建类型表
CREATE TABLE public.types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(brand_id, name)
);

-- 创建原始二维码表
CREATE TABLE public.originals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  type_id UUID REFERENCES public.types(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  scanned BOOLEAN DEFAULT false,
  scanned_at TIMESTAMP WITH TIME ZONE,
  replica_id UUID UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建副本二维码表
CREATE TABLE public.replicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  type_id UUID REFERENCES public.types(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  batch_id UUID,
  scanned BOOLEAN DEFAULT false,
  scanned_at TIMESTAMP WITH TIME ZONE,
  bound_original_id UUID UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建批次表
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  type_id UUID REFERENCES public.types(id) ON DELETE CASCADE NOT NULL,
  count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建导出任务表
CREATE TYPE export_status AS ENUM ('pending', 'processing', 'finished', 'failed');

CREATE TABLE public.export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  type_id UUID REFERENCES public.types(id) ON DELETE CASCADE NOT NULL,
  status export_status DEFAULT 'pending',
  total INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  base_url TEXT,
  file_path TEXT,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建管理员用户表（用于存储session）
CREATE TABLE public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 添加外键约束
ALTER TABLE public.originals ADD CONSTRAINT fk_originals_replica 
  FOREIGN KEY (replica_id) REFERENCES public.replicas(id) ON DELETE SET NULL;

ALTER TABLE public.replicas ADD CONSTRAINT fk_replicas_original 
  FOREIGN KEY (bound_original_id) REFERENCES public.originals(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX idx_originals_brand_type ON public.originals(brand_id, type_id);
CREATE INDEX idx_originals_scanned ON public.originals(scanned);
CREATE INDEX idx_replicas_brand_type ON public.replicas(brand_id, type_id);
CREATE INDEX idx_replicas_token ON public.replicas(token);
CREATE INDEX idx_replicas_scanned ON public.replicas(scanned);
CREATE INDEX idx_admin_sessions_session_id ON public.admin_sessions(session_id);

-- 启用 RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.originals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略（允许所有操作，因为这是内部管理系统）
CREATE POLICY "Allow all operations" ON public.brands FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.types FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.originals FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.replicas FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.batches FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.export_jobs FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.admin_sessions FOR ALL USING (true);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_types_updated_at BEFORE UPDATE ON public.types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_originals_updated_at BEFORE UPDATE ON public.originals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_replicas_updated_at BEFORE UPDATE ON public.replicas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_export_jobs_updated_at BEFORE UPDATE ON public.export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();