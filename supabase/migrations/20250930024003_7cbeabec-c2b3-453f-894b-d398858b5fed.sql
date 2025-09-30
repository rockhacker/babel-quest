-- 修改export_jobs表，允许brand_id和type_id为null，以支持'all'选项
ALTER TABLE public.export_jobs 
ALTER COLUMN brand_id DROP NOT NULL;

ALTER TABLE public.export_jobs 
ALTER COLUMN type_id DROP NOT NULL;