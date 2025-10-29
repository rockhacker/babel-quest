-- 使用Supabase内部函数正确创建用户（移除生成列confirmed_at）
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- 插入用户到auth.users表，包含所有必需的字段，但排除生成列
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@qwe.com',
    crypt('Wkmlzc2202', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    false,
    false
  ) RETURNING id INTO new_user_id;

  -- 添加管理员角色
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, 'admin'::app_role);
  
  RAISE NOTICE 'Created admin user with ID: %', new_user_id;
END $$;