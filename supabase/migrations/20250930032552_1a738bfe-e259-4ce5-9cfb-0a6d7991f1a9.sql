-- 创建导出文件存储桶
INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', true);

-- 创建存储策略
CREATE POLICY "Export files are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'exports');

CREATE POLICY "Allow authenticated users to upload export files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'exports');