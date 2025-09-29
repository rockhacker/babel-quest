-- 创建副本绑定原始码的存储过程
CREATE OR REPLACE FUNCTION public.bind_replica_to_original(
  p_replica_id UUID,
  p_brand_id UUID,
  p_type_id UUID
)
RETURNS TABLE(original_url TEXT) AS $$
DECLARE
  v_original_id UUID;
  v_original_url TEXT;
BEGIN
  -- 使用 FOR UPDATE SKIP LOCKED 获取一个可用的原始码
  SELECT id, url INTO v_original_id, v_original_url
  FROM public.originals
  WHERE brand_id = p_brand_id 
    AND type_id = p_type_id 
    AND scanned = false 
    AND replica_id IS NULL
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- 如果找不到可用的原始码
  IF v_original_id IS NULL THEN
    RETURN;
  END IF;

  -- 更新原始码状态
  UPDATE public.originals 
  SET 
    scanned = true,
    scanned_at = now(),
    replica_id = p_replica_id,
    updated_at = now()
  WHERE id = v_original_id;

  -- 更新副本状态
  UPDATE public.replicas 
  SET 
    scanned = true,
    scanned_at = now(),
    bound_original_id = v_original_id,
    updated_at = now()
  WHERE id = p_replica_id;

  -- 返回原始码URL
  RETURN QUERY SELECT v_original_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;