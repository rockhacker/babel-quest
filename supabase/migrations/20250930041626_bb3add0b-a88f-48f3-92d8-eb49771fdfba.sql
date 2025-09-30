-- 修复安全警告：设置函数的 search_path
CREATE OR REPLACE FUNCTION public.bind_replica_to_original(p_replica_id uuid, p_brand_id uuid, p_type_id uuid)
 RETURNS TABLE(original_url text, is_fallback boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_original_id UUID;
  v_original_url TEXT;
BEGIN
  -- 首先尝试获取一个可用的原始码（未绑定状态）
  SELECT id, url INTO v_original_id, v_original_url
  FROM public.originals
  WHERE brand_id = p_brand_id 
    AND type_id = p_type_id 
    AND scanned = false 
    AND replica_id IS NULL
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- 如果找到可用的原始码，正常绑定流程
  IF v_original_id IS NOT NULL THEN
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

    -- 返回原始码URL，标记为正常绑定
    RETURN QUERY SELECT v_original_url, false;
    RETURN;
  END IF;

  -- 如果没有可用的原始码，随机选择一个已绑定的原始码
  SELECT url INTO v_original_url
  FROM public.originals
  WHERE brand_id = p_brand_id 
    AND type_id = p_type_id 
    AND scanned = true 
    AND replica_id IS NOT NULL
  ORDER BY RANDOM()
  LIMIT 1;

  -- 如果找到已绑定的原始码
  IF v_original_url IS NOT NULL THEN
    -- 更新副本状态（标记为已扫描但不绑定到具体原始码）
    UPDATE public.replicas 
    SET 
      scanned = true,
      scanned_at = now(),
      updated_at = now()
    WHERE id = p_replica_id;

    -- 返回随机选择的原始码URL，标记为回退方案
    RETURN QUERY SELECT v_original_url, true;
    RETURN;
  END IF;

  -- 如果连已绑定的原始码都没有，返回空
  RETURN;
END;
$function$